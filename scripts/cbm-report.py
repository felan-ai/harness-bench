#!/usr/bin/env python3
"""Render the Codebase Memory benchmark comparison tables.

Reads run artifacts straight from .harness-evals/runs/ and groups them by
batchId, so it works on any completed batch without re-running anything.

    python3 -m venv .venv && .venv/bin/pip install tabulate
    .venv/bin/python scripts/cbm-report.py

Set SINGLE / MULTI / REPAIR below to the batchIds you want to compare. Find
them with:

    python3 -c "
    import json,glob,os,collections
    c=collections.Counter()
    for d in glob.glob('.harness-evals/runs/cbm-q-*'):
        p=os.path.join(d,'summary.json')
        if os.path.exists(p): c[json.load(open(p))['batchId']]+=1
    [print(k,v) for k,v in sorted(c.items())]"

REPAIR is optional: it patches a single (case, arm) cell from a later batch
when the original runs died on infrastructure errors. Set it to None and drop
the `_multi` override below if you do not need it.
"""
import json, glob, os, statistics
from tabulate import tabulate

RUNS = '/Users/yavorboychev/Projects/FelanAI/harness-bench/.harness-evals/runs'
SINGLE = '20260831-222211-0f7a'   # 3-trial single-repo run vs CBM 0.1.2
MULTI  = '20260901-050042-4255'   # 3-trial multi-repo, CBM index verified working
REPAIR = '20260901-062215-1127'   # find-callers/cbm-off re-run after 3 transient `fetch failed`
CASES = ['find-callers', 'find-definition', 'not-found', 'structural-cross-ref', 'text-search']

def load(batch):
    out = []
    for d in glob.glob(os.path.join(RUNS, 'cbm-q-*')):
        p = os.path.join(d, 'summary.json')
        if not os.path.exists(p): continue
        s = json.load(open(p))
        if s.get('batchId') != batch: continue
        out.append({'case': s['caseId'].replace('cbm-q-', '').replace('-multirepo', ''),
                    'arm': s['agentName'].replace('felan-cbm-', ''),
                    'cost': (s.get('cost') or {}).get('totalCost'),
                    'dur': s['durationMs'] / 1000.0,
                    'pass': bool(s.get('pass'))})
    return out

def agg(rows):
    if not rows: return None
    c = [r['cost'] for r in rows if r['cost'] is not None]
    d = [r['dur'] for r in rows]
    return dict(mc=statistics.median(c) if c else 0.0, ac=statistics.fmean(c) if c else 0.0,
                md=statistics.median(d), ad=statistics.fmean(d),
                n=len(rows), npass=sum(1 for r in rows if r['pass']))

def cell(a, avg=True):
    if a is None: return '—'
    s = f"${a['mc']:.3f} / {a['md']:.0f}s"
    if avg and a['mc'] and abs(a['ac'] - a['mc']) / a['mc'] >= 0.30:
        s += f" (${a['ac']:.3f} avg)"
    return s

def pct(new, old):
    if not old: return 'n/a'
    v = (new - old) / old * 100
    return f"{'+' if v >= 0 else '−'}{abs(v):.0f}%"

_multi = [r for r in load(MULTI) if not (r['case']=='find-callers' and r['arm']=='off')]
_multi += load(REPAIR)
D = {'single': load(SINGLE), 'multi': _multi}
A = {(f, c, a): agg([r for r in D[f] if r['case'] == c and r['arm'] == a])
     for f in D for c in CASES for a in ('off', 'on')}
O = {(f, a): agg([r for r in D[f] if r['arm'] == a]) for f in D for a in ('off', 'on')}

def per_case_table(fixture, winners):
    return [[c, cell(A[(fixture, c, 'off')]), cell(A[(fixture, c, 'on')]), winners.get(c, '')]
            for c in CASES]

def agg_table(fixture):
    off, on = O[(fixture, 'off')], O[(fixture, 'on')]
    return [
        ['Median cost per query', f"${off['mc']:.3f}", f"${on['mc']:.3f}", pct(on['mc'], off['mc'])],
        ['Mean cost per query',   f"${off['ac']:.3f}", f"${on['ac']:.3f}", pct(on['ac'], off['ac'])],
        ['Median duration',       f"{off['md']:.0f}s", f"{on['md']:.0f}s", pct(on['md'], off['md'])],
        ['Mean duration',         f"{off['ad']:.0f}s", f"{on['ad']:.0f}s", pct(on['ad'], off['ad'])],
        ['Correctness', f"{off['npass']}/{off['n']} pass", f"{on['npass']}/{on['n']} pass",
         'tie' if off['npass'] == on['npass'] else ('on' if on['npass'] > off['npass'] else 'off')],
    ]

def show(rows, headers, align):
    print(tabulate(rows, headers=headers, tablefmt='fancy_grid', colalign=align))

def combined_case_table():
    return [[c, cell(A[('single', c, 'off')], False), cell(A[('single', c, 'on')], False),
             cell(A[('multi', c, 'off')], False), cell(A[('multi', c, 'on')], False)] for c in CASES]

def combined_agg_table():
    so, sn, mo, mn = (O[('single','off')], O[('single','on')], O[('multi','off')], O[('multi','on')])
    return [
        ['Median cost per query', f"${so['mc']:.3f}", f"${sn['mc']:.3f}", f"${mo['mc']:.3f}", f"${mn['mc']:.3f}"],
        ['Mean cost per query',   f"${so['ac']:.3f}", f"${sn['ac']:.3f}", f"${mo['ac']:.3f}", f"${mn['ac']:.3f}"],
        ['Median duration',       f"{so['md']:.0f}s", f"{sn['md']:.0f}s", f"{mo['md']:.0f}s", f"{mn['md']:.0f}s"],
        ['Mean duration',         f"{so['ad']:.0f}s", f"{sn['ad']:.0f}s", f"{mo['ad']:.0f}s", f"{mn['ad']:.0f}s"],
        ['Correctness', f"{so['npass']}/{so['n']}", f"{sn['npass']}/{sn['n']}",
         f"{mo['npass']}/{mo['n']}", f"{mn['npass']}/{mn['n']}"],
    ]

def scope_deltas():
    rows = []
    for label, a in (('CBM off  (grep control)', 'off'), ('CBM on', 'on')):
        s, m = O[('single', a)], O[('multi', a)]
        rows.append([label, f"${s['mc']:.3f} / {s['md']:.0f}s", f"${m['mc']:.3f} / {m['md']:.0f}s",
                     pct(m['mc'], s['mc']), pct(m['md'], s['md'])])
    return rows
import json, glob, os, statistics
from tabulate import tabulate

RUNS = '/Users/yavorboychev/Projects/FelanAI/harness-bench/.harness-evals/runs'
SINGLE = '20260831-222211-0f7a'   # 3-trial single-repo run vs CBM 0.1.2
MULTI  = '20260901-050042-4255'   # 3-trial multi-repo, CBM index verified working
REPAIR = '20260901-062215-1127'   # find-callers/cbm-off re-run after 3 transient `fetch failed`
CASES = ['find-callers', 'find-definition', 'not-found', 'structural-cross-ref', 'text-search']

def load(batch):
    out = []
    for d in glob.glob(os.path.join(RUNS, 'cbm-q-*')):
        p = os.path.join(d, 'summary.json')
        if not os.path.exists(p): continue
        s = json.load(open(p))
        if s.get('batchId') != batch: continue
        out.append({'case': s['caseId'].replace('cbm-q-', '').replace('-multirepo', ''),
                    'arm': s['agentName'].replace('felan-cbm-', ''),
                    'cost': (s.get('cost') or {}).get('totalCost'),
                    'dur': s['durationMs'] / 1000.0,
                    'pass': bool(s.get('pass'))})
    return out

def agg(rows):
    if not rows: return None
    c = [r['cost'] for r in rows if r['cost'] is not None]
    d = [r['dur'] for r in rows]
    return dict(mc=statistics.median(c) if c else 0.0, ac=statistics.fmean(c) if c else 0.0,
                md=statistics.median(d), ad=statistics.fmean(d),
                n=len(rows), npass=sum(1 for r in rows if r['pass']))

def cell(a, avg=True):
    if a is None: return '—'
    s = f"${a['mc']:.3f} / {a['md']:.0f}s"
    if avg and a['mc'] and abs(a['ac'] - a['mc']) / a['mc'] >= 0.30:
        s += f" (${a['ac']:.3f} avg)"
    return s

def pct(new, old):
    if not old: return 'n/a'
    v = (new - old) / old * 100
    return f"{'+' if v >= 0 else '−'}{abs(v):.0f}%"

_multi = [r for r in load(MULTI) if not (r['case']=='find-callers' and r['arm']=='off')]
_multi += load(REPAIR)
D = {'single': load(SINGLE), 'multi': _multi}
A = {(f, c, a): agg([r for r in D[f] if r['case'] == c and r['arm'] == a])
     for f in D for c in CASES for a in ('off', 'on')}
O = {(f, a): agg([r for r in D[f] if r['arm'] == a]) for f in D for a in ('off', 'on')}

def per_case_table(fixture, winners):
    return [[c, cell(A[(fixture, c, 'off')]), cell(A[(fixture, c, 'on')]), winners.get(c, '')]
            for c in CASES]

def agg_table(fixture):
    off, on = O[(fixture, 'off')], O[(fixture, 'on')]
    return [
        ['Median cost per query', f"${off['mc']:.3f}", f"${on['mc']:.3f}", pct(on['mc'], off['mc'])],
        ['Mean cost per query',   f"${off['ac']:.3f}", f"${on['ac']:.3f}", pct(on['ac'], off['ac'])],
        ['Median duration',       f"{off['md']:.0f}s", f"{on['md']:.0f}s", pct(on['md'], off['md'])],
        ['Mean duration',         f"{off['ad']:.0f}s", f"{on['ad']:.0f}s", pct(on['ad'], off['ad'])],
        ['Correctness', f"{off['npass']}/{off['n']} pass", f"{on['npass']}/{on['n']} pass",
         'tie' if off['npass'] == on['npass'] else ('on' if on['npass'] > off['npass'] else 'off')],
    ]

def show(rows, headers, align):
    print(tabulate(rows, headers=headers, tablefmt='fancy_grid', colalign=align))

def combined_case_table():
    return [[c, cell(A[('single', c, 'off')], False), cell(A[('single', c, 'on')], False),
             cell(A[('multi', c, 'off')], False), cell(A[('multi', c, 'on')], False)] for c in CASES]

def combined_agg_table():
    so, sn, mo, mn = (O[('single','off')], O[('single','on')], O[('multi','off')], O[('multi','on')])
    return [
        ['Median cost per query', f"${so['mc']:.3f}", f"${sn['mc']:.3f}", f"${mo['mc']:.3f}", f"${mn['mc']:.3f}"],
        ['Mean cost per query',   f"${so['ac']:.3f}", f"${sn['ac']:.3f}", f"${mo['ac']:.3f}", f"${mn['ac']:.3f}"],
        ['Median duration',       f"{so['md']:.0f}s", f"{sn['md']:.0f}s", f"{mo['md']:.0f}s", f"{mn['md']:.0f}s"],
        ['Mean duration',         f"{so['ad']:.0f}s", f"{sn['ad']:.0f}s", f"{mo['ad']:.0f}s", f"{mn['ad']:.0f}s"],
        ['Correctness', f"{so['npass']}/{so['n']}", f"{sn['npass']}/{sn['n']}",
         f"{mo['npass']}/{mo['n']}", f"{mn['npass']}/{mn['n']}"],
    ]

def scope_deltas():
    rows = []
    for label, a in (('CBM off  (grep control)', 'off'), ('CBM on', 'on')):
        s, m = O[('single', a)], O[('multi', a)]
        rows.append([label, f"${s['mc']:.3f} / {s['md']:.0f}s", f"${m['mc']:.3f} / {m['md']:.0f}s",
                     pct(m['mc'], s['mc']), pct(m['md'], s['md'])])
    return rows
