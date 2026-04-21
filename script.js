let i=0,h=JSON.parse(localStorage.getItem("h"))||[];
function show(){let t=dataset[i],html="",act="";
if(t.type==="ranking"){t.responses.forEach((r,x)=>{html+=r+"<br>";act+=`<button onclick='ans(${x})'>${x}</button>`})}
else{t.trace.forEach(s=>html+=s+"<br>");act+="<button onclick='dbg()'>Submit</button>"}
document.getElementById("task").innerHTML=html;
document.getElementById("actions").innerHTML=act;}
function ans(c){let ok=c===dataset[i].correct;save(ok)}
function dbg(){let x=prompt("root?");let ok=x&&x.includes(dataset[i].correct);save(ok)}
function save(ok){h.push({ok});localStorage.setItem("h",JSON.stringify(h));upd();}
function upd(){let t=h.length,c=h.filter(x=>x.ok).length;
document.getElementById("total").innerText=t;
document.getElementById("correct").innerText=c;
document.getElementById("accuracy").innerText=t?((c/t)*100).toFixed(1):0;}
function nextTask(){i=(i+1)%dataset.length;show();}
function exportResults(){let blob=new Blob([JSON.stringify(h,null,2)]);
let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="results.json";a.click();}
show();upd();