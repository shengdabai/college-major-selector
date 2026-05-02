#!/usr/bin/env python3
"""解析 xls + pdf -> data/universities.json + data/majors.json"""
import json, os, re
import xlrd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLS = os.path.join(ROOT, '全国普通高校名单.xls')
PDF = os.path.join(ROOT, '大学专业目录.pdf')
DATA = os.path.join(ROOT, 'data')
os.makedirs(DATA, exist_ok=True)

# ---------- 985 / 211 / 双一流（来源：教育部公开名单） ----------
LIST_985 = set("""北京大学 中国人民大学 清华大学 北京航空航天大学 北京理工大学 中国农业大学 北京师范大学 中央民族大学 南开大学 天津大学 大连理工大学 东北大学 吉林大学 哈尔滨工业大学 复旦大学 同济大学 上海交通大学 华东师范大学 南京大学 东南大学 浙江大学 中国科学技术大学 厦门大学 山东大学 中国海洋大学 武汉大学 华中科技大学 湖南大学 中南大学 中山大学 华南理工大学 四川大学 重庆大学 电子科技大学 西安交通大学 西北工业大学 兰州大学 国防科技大学 西北农林科技大学 中央民族大学""".split())
LIST_211 = LIST_985 | set("""北京交通大学 北京工业大学 北京科技大学 北京化工大学 北京邮电大学 北京林业大学 北京中医药大学 北京外国语大学 中国传媒大学 中央财经大学 对外经济贸易大学 北京体育大学 中国政法大学 华北电力大学 中国矿业大学（北京） 中国石油大学（北京） 中国地质大学（北京） 天津医科大学 河北工业大学 太原理工大学 内蒙古大学 辽宁大学 大连海事大学 延边大学 东北师范大学 东北林业大学 东北农业大学 哈尔滨工程大学 东华大学 上海财经大学 上海大学 上海外国语大学 华东理工大学 河海大学 江南大学 南京理工大学 南京航空航天大学 南京农业大学 中国药科大学 南京师范大学 苏州大学 中国矿业大学 安徽大学 合肥工业大学 福州大学 南昌大学 中国海洋大学 中国石油大学（华东） 郑州大学 中国地质大学（武汉） 武汉理工大学 华中农业大学 华中师范大学 中南财经政法大学 湖南师范大学 暨南大学 华南师范大学 海南大学 广西大学 西南交通大学 西南大学 西南财经大学 四川农业大学 贵州大学 云南大学 西藏大学 西北大学 长安大学 陕西师范大学 西安电子科技大学 青海大学 宁夏大学 新疆大学 石河子大学 第二军医大学 第四军医大学 北京体育大学""".split())
# 双一流（部分新增非 985/211 院校）
LIST_SHUANGYILIU = LIST_211 | set("""上海科技大学 南方科技大学 中国科学院大学 宁波大学 河南大学 华南农业大学 广州中医药大学 上海海洋大学 南京邮电大学 南京林业大学 南京中医药大学 南京信息工程大学 成都理工大学 成都中医药大学 西南石油大学 首都师范大学 中国美术学院 中央戏剧学院 中央音乐学院 中国音乐学院 中国人民公安大学 北京协和医学院 外交学院 国际关系学院 中央美术学院 上海中医药大学 天津工业大学 天津中医药大学""".split())

def school_level(name, layer):
    """返回主标签（最高级别）"""
    if name in LIST_985: return '985'
    if name in LIST_211: return '211'
    if name in LIST_SHUANGYILIU: return '双一流'
    if layer == '本科': return '普通本科'
    if '专科' in (layer or '') or '高职' in (layer or ''): return '专科'
    if '职业' in (layer or ''): return '本科职业'
    return layer or '其他'

def school_tags(name, layer):
    """所有适用的标签（多个并存）。
    设计：985 学校同时拥有 [985, 211, 双一流]；211 学校同时拥有 [211, 双一流] 等。
    这样筛选"双一流"=147 所、筛选"211"≈116 所、筛选"985"=39 所，均符合直觉。"""
    tags = []
    if name in LIST_985:
        tags += ['985', '211', '双一流']  # 所有 985 都是 211 + 双一流
    elif name in LIST_211:
        tags += ['211', '双一流']           # 211 默认进双一流（极少例外，可接受误差）
    elif name in LIST_SHUANGYILIU:
        tags.append('双一流')
    if '职业' in (name or '') or '职业' in (layer or ''):
        tags.append('本科职业')
    if layer and layer not in ('本科',):
        tags.append(layer)
    if not tags:
        tags.append('普通本科' if layer == '本科' else (layer or '其他'))
    # 去重保序
    return list(dict.fromkeys(tags))

# ---------- 解析 xls ----------
def parse_universities():
    b = xlrd.open_workbook(XLS)
    s = b.sheet_by_index(0)
    unis = []
    province = None
    province_re = re.compile(r'^(.+?)（\d+所）$')
    for i in range(s.nrows):
        row = s.row_values(i)
        first_raw = row[0]
        first = first_raw.strip() if isinstance(first_raw, str) else ''
        # 省份头行（字符串）
        if first:
            m = province_re.match(first)
            if m:
                province = m.group(1).strip()
                continue
            if first in ('序号',) or '名单' in first or '附件' in first:
                continue
        # 序号行：first_raw 是 float
        if isinstance(first_raw, float):
            seq = int(first_raw)
        else:
            continue
        name = (row[1] or '').strip()
        code = row[2]
        bureau = (row[3] or '').strip()
        location = (row[4] or '').strip()  # 城市
        layer = (row[5] or '').strip()      # 本科/专科
        note = (row[6] or '').strip()
        if not name: continue
        # 公办/民办/中外合作 推断
        owner = '公办'
        if '民办' in note: owner = '民办'
        elif '中外合作' in note: owner = '中外合作'
        elif '内地与港澳台地区合作' in note: owner = '与港澳台合作'
        unis.append({
            'id': str(int(code)) if isinstance(code, float) else str(code),
            'name': name,
            'province': province or '',
            'city': location or province or '',
            'bureau': bureau,
            'layer': layer,
            'note': note,
            'owner': owner,
            'level': school_level(name, layer),
            'tags': school_tags(name, layer),
        })
    return unis

# ---------- 解析 PDF ----------
RAW = open('/tmp/majors_raw.txt','r').read() if os.path.exists('/tmp/majors_raw.txt') else None
def get_pdf_text():
    global RAW
    if RAW: return RAW
    import pdfplumber
    with pdfplumber.open(PDF) as p:
        RAW = '\n'.join((pg.extract_text() or '') for pg in p.pages)
    return RAW

def parse_majors():
    txt = get_pdf_text()
    # 学科门类: ^\d{2}\s+学科门类：xxx
    # 专业类: ^\d{4}\s+xxx类
    # 专业:  ^\d{6}[TK]{0,2}\s+xxx
    cat_re = re.compile(r'^(\d{2})\s+学科门类[:：]\s*(.+)$')
    sub_re = re.compile(r'^(\d{4})\s+(.+?[类科])\s*$')
    maj_re = re.compile(r'^(\d{6}[TK]{0,3})\s+(.+?)$')
    categories = {}  # code -> {name, subs:{code:{name,majors:[]}}}
    cur_cat = cur_sub = None
    for raw_line in txt.split('\n'):
        line = raw_line.strip()
        if not line: continue
        m = cat_re.match(line)
        if m:
            cur_cat = m.group(1)
            categories[cur_cat] = {'code': cur_cat, 'name': m.group(2).strip(), 'subs': {}}
            cur_sub = None
            continue
        m = sub_re.match(line)
        if m and cur_cat:
            cur_sub = m.group(1)
            categories[cur_cat]['subs'][cur_sub] = {
                'code': cur_sub, 'name': m.group(2).strip(), 'majors': []
            }
            continue
        m = maj_re.match(line)
        if m and cur_cat and cur_sub:
            code = m.group(1)
            name = re.sub(r'\s+', '', m.group(2)).split('（')[0]  # 去掉 (注：xxx)
            note = ''
            if '（注' in m.group(2):
                note = '（' + m.group(2).split('（', 1)[1]
            categories[cur_cat]['subs'][cur_sub]['majors'].append({
                'code': code,
                'name': name,
                'note': note,
                'is_special': 'T' in code,    # 特设
                'is_controlled': 'K' in code, # 国家控制
            })
    # 转 list
    out = []
    for c in categories.values():
        out.append({
            'code': c['code'],
            'name': c['name'],
            'subs': [s for s in c['subs'].values()],
        })
    out.sort(key=lambda x: x['code'])
    return out

if __name__ == '__main__':
    unis = parse_universities()
    majors = parse_majors()
    # 统计
    flat_majors = []
    for cat in majors:
        for sub in cat['subs']:
            for m in sub['majors']:
                flat_majors.append({
                    **m,
                    'category_code': cat['code'],
                    'category_name': cat['name'],
                    'sub_code': sub['code'],
                    'sub_name': sub['name'],
                })
    print(f'高校: {len(unis)}, 学科门类: {len(majors)}, 专业类: {sum(len(c["subs"]) for c in majors)}, 专业: {len(flat_majors)}')
    # 等级分布
    from collections import Counter
    print('等级:', Counter(u['level'] for u in unis).most_common())
    print('省份:', len(set(u['province'] for u in unis)))
    json.dump(unis, open(os.path.join(DATA, 'universities.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))
    json.dump(majors, open(os.path.join(DATA, 'majors.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))
    json.dump(flat_majors, open(os.path.join(DATA, 'majors_flat.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))
    print('written ->', DATA)
