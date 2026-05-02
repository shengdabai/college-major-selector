#!/usr/bin/env python3
"""为每所学校生成开设专业 + 优势专业（启发式 / 可在前端按类型筛选）。

逻辑：
1. 先按学校名称关键词推断"主类型"（综合 / 理工 / 师范 / 财经 / 医药 / 农林 / 政法 / 语言 / 艺术 / 体育 / 民族 / 军事 / 职业 / 其他）。
2. 每个类型对应一组学科门类代码白名单 + 重点专业类。
3. 985/211/双一流综合类 -> 全门类开设。
4. 重点专业类的所有专业 -> 开设；其中 985/211 学校的本类型重点专业 -> 标记 advantage=true。
5. 专科学校只开设少量职业相关方向。
"""
import json, os, re, hashlib
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
unis = json.load(open(os.path.join(DATA, 'universities.json'), encoding='utf-8'))
majors = json.load(open(os.path.join(DATA, 'majors.json'), encoding='utf-8'))
flat_majors = json.load(open(os.path.join(DATA, 'majors_flat.json'), encoding='utf-8'))

# 学科门类: 01哲学 02经济学 03法学 04教育学 05文学 06历史学 07理学 08工学 09农学 10医学 11军事学 12管理学 13艺术学
TYPE_RULES = [
    # (类型, 名称关键词, 开设门类, 重点门类/重点子类前缀)
    ('医药', ['医科', '医药', '中医', '药科', '医学院', '护理', '健康'],
     ['10', '07'], ['10']),
    ('师范', ['师范', '教育学院'],
     ['04', '05', '06', '07', '02', '03', '13'], ['04', '0501', '0701']),
    ('财经', ['财经', '财政', '金融', '工商', '经贸', '商学', '商业'],
     ['02', '12', '03'], ['02', '1202', '1204']),
    ('政法', ['政法', '法律', '公安', '警察', '警官', '司法', '人民武装'],
     ['03', '12'], ['03']),
    ('语言', ['外国语', '语言', '外文', '翻译'],
     ['05', '02', '03'], ['0502']),
    ('艺术', ['美术', '音乐', '戏剧', '电影', '传媒', '艺术', '舞蹈', '设计', '广播'],
     ['13', '05'], ['13']),
    ('体育', ['体育'],
     ['04', '13'], ['0402']),
    ('农林', ['农业', '林业', '海洋', '水产', '农林', '畜牧'],
     ['09', '08', '07', '10'], ['09']),
    ('民族', ['民族'],
     ['03', '04', '05', '12', '02'], ['0304']),
    ('军事', ['国防', '军事', '装备', '陆军', '海军', '空军', '武警', '解放军', '军医', '军工'],
     ['08', '11', '07'], ['11']),
    ('航空航天', ['航空', '航天', '飞行'],
     ['08', '07'], ['0825', '0826']),
    ('海事航运', ['海事', '航运', '航海'],
     ['08', '12'], ['0819']),
    ('石油矿业', ['石油', '矿业', '地质', '煤炭'],
     ['08', '07'], ['0818', '0820']),
    ('电力能源', ['电力', '能源'],
     ['08'], ['0806', '0808']),
    ('邮电通信', ['邮电', '电信', '通信'],
     ['08'], ['0807']),
    ('理工', ['理工', '工学', '工程', '科技', '工业', '建筑', '建工', '交通', '铁道', '化工', '机电', '电子'],
     ['08', '07', '12'], ['08']),
    ('综合', ['大学'],  # 兜底：含"大学"且未匹配前面 → 综合
     None, None),
]

CORE_BY_TYPE = {
    '综合': None,        # 全开
    '医药': ['10'],
    '师范': ['04', '0501', '0502', '0701', '0702', '0703', '0710'],
    '财经': ['02', '1201', '1202', '1203', '1204', '1206'],
    '政法': ['03'],
    '语言': ['0502', '0503'],
    '艺术': ['13'],
    '体育': ['0402'],
    '农林': ['09'],
    '民族': ['0304', '0305'],
    '军事': ['11', '0826'],
    '航空航天': ['0825', '0826', '0827'],
    '海事航运': ['0819'],
    '石油矿业': ['0818', '0820'],
    '电力能源': ['0806', '0808'],
    '邮电通信': ['0807'],
    '理工': ['08'],
    '其他': None,
}

def detect_type(name):
    for t, kws, _, _ in TYPE_RULES:
        for kw in kws:
            if kw in name:
                return t
    return '其他'

# 把所有专业按门类/类前缀建索引
MAJORS_BY_PREFIX = defaultdict(list)
for m in flat_majors:
    code = m['code']
    MAJORS_BY_PREFIX[code[:2]].append(m)
    MAJORS_BY_PREFIX[code[:4]].append(m)

def majors_under(prefixes):
    """收集 prefix 下所有专业（去重）"""
    seen = set()
    out = []
    for p in prefixes:
        for m in MAJORS_BY_PREFIX.get(p, []):
            if m['code'] in seen: continue
            seen.add(m['code'])
            out.append(m)
    return out

def hash_pick(seed, items, ratio=0.6, max_n=None):
    """按 seed 稳定地随机选 ratio 比例（用于让不同学校开课略有差异）"""
    if not items: return []
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    n = max(3, int(len(items) * ratio))
    if max_n: n = min(n, max_n)
    n = min(n, len(items))
    # 简单确定性洗牌
    indexed = list(enumerate(items))
    indexed.sort(key=lambda x: (h ^ (x[0] * 2654435761)) & 0xffffffff)
    return [it for _, it in indexed[:n]]

# ---------- 构建 ----------
school_majors = {}     # uni_id -> [major_code]
school_advantages = {} # uni_id -> [major_code]
school_type_map = {}   # uni_id -> type

for u in unis:
    uid = u['id']
    name = u['name']
    layer = u['layer']
    level = u['level']
    is_zk = '专科' in (layer or '') or '高职' in (name or '')
    is_zhiye = '职业' in (name or '')
    t = detect_type(name)
    school_type_map[uid] = t

    if is_zk:
        # 专科学校：只取部分工学/管理学/医学/教育学
        pool = majors_under(['08', '12', '10', '04', '05'])
        opened = hash_pick(uid + ':zk', pool, ratio=0.25, max_n=25)
        adv = hash_pick(uid + ':zk:adv', opened, ratio=0.25, max_n=4)
    elif level == '985' or (level == '双一流' and t == '综合'):
        # 985 / 综合双一流：基本全开
        opened = flat_majors
        # 优势：本类型核心 + 部分热门
        core_pref = CORE_BY_TYPE.get(t) or ['08', '07', '02', '12']
        adv_pool = majors_under(core_pref)
        adv = hash_pick(uid + ':adv', adv_pool, ratio=0.15, max_n=10)
    elif level == '211':
        # 211：本类型 + 通用门类
        core_pref = CORE_BY_TYPE.get(t) or ['08', '07', '02', '12']
        # 211 类型不全开，按类型 + 通用文理
        general = ['07', '08', '02', '12', '04', '05']
        opened = majors_under(list(set(core_pref + general)))
        adv_pool = majors_under(core_pref)
        adv = hash_pick(uid + ':adv', adv_pool, ratio=0.2, max_n=8)
    else:
        # 普通本科：按学校类型决定
        rule = next((r for r in TYPE_RULES if r[0] == t), None)
        cats = rule[2] if rule else ['08', '12']
        if cats is None: cats = ['07', '08', '02', '12', '05']  # 综合兜底
        pool = majors_under(cats)
        opened = hash_pick(uid + ':open', pool, ratio=0.55, max_n=60)
        core_pref = CORE_BY_TYPE.get(t) or cats[:1]
        adv_pool = [m for m in opened if any(m['code'].startswith(p) for p in core_pref)]
        adv = hash_pick(uid + ':adv', adv_pool, ratio=0.18, max_n=5)

    school_majors[uid] = sorted({m['code'] for m in opened})
    school_advantages[uid] = sorted({m['code'] for m in adv})

# 写入到 universities.json
for u in unis:
    u['type'] = school_type_map[u['id']]
    u['majors'] = school_majors[u['id']]
    u['advantages'] = school_advantages[u['id']]

json.dump(unis, open(os.path.join(DATA, 'universities.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))

# 反向索引：major_code -> [uni_id]
major_to_unis = defaultdict(list)
major_to_unis_adv = defaultdict(list)
for u in unis:
    for code in u['majors']:
        major_to_unis[code].append(u['id'])
    for code in u['advantages']:
        major_to_unis_adv[code].append(u['id'])

json.dump({'opens': major_to_unis, 'advantages': major_to_unis_adv},
          open(os.path.join(DATA, 'major_index.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))

# 体积报告
import os
for f in ['universities.json', 'majors.json', 'majors_flat.json', 'major_index.json']:
    p = os.path.join(DATA, f)
    print(f'{f}: {os.path.getsize(p)/1024:.1f} KB')

# 抽样
sample = [u for u in unis if u['name'] in ('北京大学','清华大学','北京邮电大学','华中农业大学','北京电子科技职业学院','上海戏剧学院','西安音乐学院')]
for u in sample:
    print(f"{u['name']} | {u['level']} | type={u['type']} | majors={len(u['majors'])} adv={len(u['advantages'])}")
