"""Deterministic test generator for the Recursion Practice module."""
import json
from pathlib import Path
PATH = Path(__file__).with_name("problems.json")

def r_sum(n): return n * (n + 1) // 2
def r_count(t, x):
    return int(x == t) if isinstance(x, int) else sum(r_count(t, y) for y in x)
def r_flat(x):
    if isinstance(x, int): return [x]
    out = []
    for y in x: out.extend(r_flat(y))
    return out
def r_storage(d):
    return sum(r_storage(v) if isinstance(v, dict) else v for v in d.values())
def r_eval(e):
    if isinstance(e, int): return e
    op, x, y = e; a, b = r_eval(x), r_eval(y)
    return a+b if op == "+" else a-b if op == "-" else a*b
def enc(x):
    if isinstance(x, list): return {"$list":[enc(y) for y in x]}
    if isinstance(x, tuple): return [enc(y) for y in x]
    if isinstance(x, dict): return {k:enc(v) for k,v in x.items()}
    return x
def leaves(x): return 1 if isinstance(x,int) else sum(leaves(y) for y in x)
def depth(x): return 0 if isinstance(x,int) else 1+max((depth(y) for y in x),default=0)
def entries(d): return sum(1+(entries(v) if isinstance(v,dict) else 0) for v in d.values())
def folder_depth(d): return max((1+folder_depth(v) if isinstance(v,dict) else 0 for v in d.values()),default=0)
def ops(e): return 0 if isinstance(e,int) else 1+ops(e[1])+ops(e[2])
def expr_depth(e): return 0 if isinstance(e,int) else 1+max(expr_depth(e[1]),expr_depth(e[2]))

CASES = {
"R1":[("zero",(0,)),("one",(1,)),("small",(4,)),("small boundary",(20,)),("medium",(21,)),("max",(300,))],
"R2":[("empty",(1,())),("single match",(4,(4,))),("no match",(7,(1,2,3))),("nested sample",(1,(1,(2,1),(1,(3,1))))),("deep empty branches",(2,((),((),(2,)),()))),("duplicates",(5,(5,5,(5,),(1,(5,5))))),("many values",(2,tuple(range(1,31))))],
"R3":[("empty",((),)),("single",((7,),)),("sample",((1,(2,(3,4)),5),)),("empty branches",(((1,2),(),(3,)),)),("negative values",((-1,(-2,()),3),)),("deep",((1,((2,((3,((4,),)),)),)),)),("many leaves",(tuple(range(30)),))],
"R4":[("empty",({},)),("one file",({"a.txt":12},)),("empty folder",({"empty":{}},)),("sample",({"notes.txt":10,"school":{"cs11.pdf":100,"old":{"answers.pdf":50}},"empty":{}},)),("zero byte",({"zero.bin":0,"folder":{"also.zero":0}},)),("mixed folders",({"a":1,"b":{"c":2,"d":{"e":3}},"f":4},)),("large sizes",({"big.bin":10**9,"folder":{"huge.bin":10**9}},))],
"R5":[("literal",(7,)),("addition",(("+",2,3),)),("sample",(("+",3,("*",2,4)),)),("subtraction",(("-",("+",8,2),5),)),("multiplication",(("*",7,6),)),("negative literals",(("+",-5,("*",-2,3)),)),("left nested",(("*",("+",1,2),("-",8,3)),)),("deep",(("+",1,("*",2,("-",9,("+",3,("*",2,4))))),)),("many operations",(("*",("+",1,2),("*",("+",3,4),("+",5,6))),))]
}
REF = {"R1":lambda a:r_sum(*a),"R2":lambda a:r_count(*a),"R3":lambda a:r_flat(*a),"R4":lambda a:r_storage(*a),"R5":lambda a:r_eval(*a)}
def tags(pid,a):
    small = (a[0] <= 20 if pid=="R1" else
             leaves(a[1]) <= 20 if pid=="R2" else
             leaves(a[0]) <= 20 and depth(a[0]) <= 3 if pid=="R3" else
             entries(a[0]) <= 10 and folder_depth(a[0]) <= 3 if pid=="R4" else
             ops(a[0]) <= 10 and expr_depth(a[0]) <= 3)
    return ["all"] + (["small"] if small else [])
def main():
    data=json.loads(PATH.read_text())
    for p in data["problems"]:
        p["tests"]=[{"name":n,"args":enc(a),"expected":enc(REF[p["id"]](a)),"tags":tags(p["id"],a)} for n,a in CASES[p["id"]]]
    PATH.write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n")
if __name__=="__main__": main()
