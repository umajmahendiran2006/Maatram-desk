// DATA LAYER: constants, demo data, storage, helpers, reminder scan
const H=36e5,CATS=['Admission','Scholarship','Events','Mentoring','Technical','Other'],STAT=['New','Assigned','In progress','Waiting for student','Resolved','Closed'],PRI=['Low','Medium','High','Urgent'],CH=['WhatsApp','Phone call','Email','Form','In person'],SLA={Low:120,Medium:72,High:48,Urgent:24};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const $=s=>document.querySelector(s);
let authUp=false,db,me=null,view='dash',openId=null,flt={q:'',cat:'',st:'',co:'',d:''};
function addIds(a){const c={};a.forEach(u=>{c[u.role]=(c[u.role]||0)+1;u.mid='MT-'+({stu:'S',rep:'R',coord:'C',admin:'A'})[u.role]+String(c[u.role]).padStart(3,'0');u.pw='maatram123'});a.push({id:'s4',name:'Divya S',role:'stu',mid:'MT-S004',pw:''},{id:'s5',name:'Pooja N',role:'stu',mid:'MT-S005',pw:''});return a}
function seed(){const n=Date.now(),rules={Admission:'c1',Scholarship:'c2',Events:'c3',Mentoring:'c3',Technical:'c2',Other:'c1'};
const R=[['Ananya P','Anna University','Admission','WhatsApp','High','Needs bonafide certificate for admission file','In progress',60,20,'u1'],
['Rohit M','VIT Chennai','Scholarship','Email','Urgent','Scholarship amount not credited after approval','Assigned',90,80,'u2'],
['Sneha L','SRM','Events','Form','Low','Where is the venue for Saturday’s session?','Resolved',30,10,'u1'],
['Imran K','Loyola College','Mentoring','Phone call','Medium','Wants a mentor for placement preparation','Waiting for student',100,70,'u2'],
['Divya S','PSG Tech','Technical','WhatsApp','High','Cannot open the session link on mobile','New',5,5,'u1'],
['Arjun V','NIT Trichy','Admission','In person','Medium','Missing marksheet upload on the portal','In progress',40,30,'u2'],
['Kavya R','MCC','Scholarship','Form','Medium','Fee waiver form deadline query','Assigned',26,26,'u1'],
['Naveen T','SSN College','Other','Email','Low','Request for event participation certificate','Closed',200,150,'u2'],
['Pooja N','Anna University','Events','WhatsApp','Urgent','Registration closed but name missing from list','New',20,20,'u2'],
['Surya B','Amrita','Technical','Phone call','Medium','Login OTP not arriving','In progress',55,50,'u1'],
['Lakshmi G','Stella Maris','Mentoring','Form','Low','Wants to change assigned mentor','Resolved',120,40,'u1'],
['Faizal A','VIT Vellore','Admission','Email','High','Fee receipt mismatch with admission record','Assigned',75,75,'u2']];
const qs=R.map((r,i)=>{const [student,inst,cat,ch,pri,desc,status,cH,uH,by]=r,c=n-cH*H,u=n-uH*H,o=rules[cat];
const hist=[{t:c,u:by,x:'Query logged via '+ch}];if(status!=='New')hist.push({t:c+36e5,u:'System',x:'Auto-assigned to '+({c1:'Priya Nair',c2:'Karthik S',c3:'Meena R'})[o]});
if(['In progress','Waiting for student','Resolved','Closed'].includes(status))hist.push({t:u,u:o,x:'Status → '+status});
return{id:'Q-'+(1001+i),student,inst,cat,ch,pri,desc,files:[],status,owner:status==='New'?'':o,by,created:c,updated:u,resolved:/Resolved|Closed/.test(status)?u:0,hist,rem:{}}});
return{users:addIds([{id:'s1',name:'Imran K',role:'stu'},{id:'s2',name:'Ananya P',role:'stu'},{id:'s3',name:'Rohit M',role:'stu'},{id:'u1',name:'Aisha Khan',role:'rep'},{id:'u2',name:'Rahul Dev',role:'rep'},{id:'c1',name:'Priya Nair',role:'coord'},{id:'c2',name:'Karthik S',role:'coord'},{id:'c3',name:'Meena R',role:'coord'},{id:'a1',name:'Dr. Senthil (Admin)',role:'admin'}]),
rules,cfg:{nudge:24,escalate:24,student:48},qs,log:[]}}
function load(){try{const s=localStorage.getItem('mh28');if(s)return JSON.parse(s)}catch(e){}return seed()}
function save(){try{localStorage.setItem('mh28',JSON.stringify(db))}catch(e){}}
const U=id=>db.users.find(u=>u.id===id)||{name:id==='System'?'System':'Unassigned'};
const Q=id=>db.qs.find(q=>q.id===id);
const isOpen=q=>!/Resolved|Closed/.test(q.status),due=q=>q.created+SLA[q.pri]*H,od=q=>isOpen(q)&&Date.now()>due(q);
function ago(t){const h=Math.round((Date.now()-t)/H);return h<1?'just now':h<48?h+'h ago':Math.round(h/24)+'d ago'}
function dueTxt(q){if(!isOpen(q))return'Closed';const h=Math.round((due(q)-Date.now())/H);return h<0?'Overdue '+(-h)+'h':'Due in '+h+'h'}
function mine(){return me.role==='admin'?db.qs:me.role==='coord'?db.qs.filter(q=>q.owner===me.id):me.role==='stu'?db.qs.filter(q=>q.student===me.name):db.qs.filter(q=>q.by===me.id)}
function add(q,u,x){q.hist.push({t:Date.now(),u,x});q.updated=Date.now()}
function note(to,txt,type){db.log.unshift({t:Date.now(),to,txt,type})}
function tt(m){const t=$('#toast');t.innerHTML='<div class="toast">'+esc(m)+'</div>';setTimeout(()=>t.innerHTML='',2200)}
function scan(){let c=0;db.qs.filter(isOpen).forEach(q=>{const r=q.rem=q.rem||{},idle=(Date.now()-q.updated)/H;
if(q.status==='Waiting for student'){if(idle>db.cfg.student&&(r.s||0)<q.updated){r.s=Date.now();note(q.student,'Reminder: your reply is needed on '+q.id,'Student reminder');c++}}
else if(q.owner&&idle>db.cfg.nudge&&(r.n||0)<q.updated){r.n=Date.now();note(U(q.owner).name,'Nudge: '+q.id+' has had no update for '+Math.round(idle)+'h','Coordinator nudge');c++}
if(od(q)&&(Date.now()-due(q))/H>db.cfg.escalate&&(r.e||0)<q.updated){r.e=Date.now();q.hist.push({t:Date.now(),u:'System',x:'Escalated to senior coordinator / admin'});note('Admin','Escalation: '+q.id+' is overdue ('+q.cat+')','Escalation');c++}});save();return c}