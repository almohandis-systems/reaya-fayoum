import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'firebase/auth';
import {getFirestore,collection,doc,onSnapshot,query,where,writeBatch,setDoc,serverTimestamp,runTransaction,getDocs} from 'firebase/firestore';
import config from './firebase-config.json';
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
const OWNER_UID='CWo2ULEH4oZviK7VXgrFP9e45Sz1';
let providers=[],members=[],requests=[],owner=false,ready=false,stops=[];
const clone=x=>JSON.parse(JSON.stringify(x));
const safe=x=>typeof x==='string'?!/[<>"'`\\&]/.test(x)&&x.length<=2000:Array.isArray(x)?x.every(safe):x&&typeof x==='object'?Object.values(x).every(safe):true;
const fail=e=>{console.error(e.code||e.message);alert((e.code?'['+e.code+'] ':'')+'تعذر إتمام العملية. تحقق من الاتصال والصلاحيات وحاول مجدداً.');};
function refresh(){populateCentersSelectors();updateCategoryCounts();renderCards();if(owner){renderAdminTable();renderMembersTable();renderRequestsTable();calculateStats();}}
function watch(name,assign,q){return onSnapshot(q||collection(db,name),s=>{assign(s.docs.map(d=>({...d.data(),id:d.id})));refresh();},fail);}
window.getItems=()=>clone(providers).filter(e=>!e.seedRecord&&!/^(?:عيادة|عياده|صيدلية|صيدليه|معمل|مركز(?:\s+أشعة)?|طبيب)\s*[0-9٠-٩]+$/u.test((e.name||" ").trim()));
window.getMemberCards=()=>owner?clone(members):[];
window.getJoinRequests=()=>owner?clone(requests):[];
async function persist(name,before,after){if(!owner)throw Error('owner-only');if(!safe(after))throw Error('invalid-characters');const batch=writeBatch(db),ids=new Set(after.map(r=>r.id));for(const row of before)if(!ids.has(row.id))batch.delete(doc(db,name,row.id));for(const row of after)if(JSON.stringify(before.find(r=>r.id===row.id))!==JSON.stringify(row))batch.set(doc(db,name,row.id),name==='providers'?{...row,approved:true}:row);await batch.commit();}
window.saveItems=async rows=>{await persist('providers',providers,rows);};
window.saveMemberCards=async rows=>{await persist('members',members,rows);};
window.saveJoinRequests=async rows=>{await persist('requests',requests,rows);};
window.openPinModal=()=>{if(owner)return openAdminDashboard();document.getElementById('pinModal').classList.remove('hidden');};
window.verifyPin=async()=>{if(window.matchMedia&&matchMedia('(display-mode: standalone)').matches||navigator.standalone){alert('تسجيل الدخول داخل التطبيق غير مدعوم على هذا الجهاز. سيتم فتح كروم لتسجيل دخول المالك، ثم افتح لوحة المالك من نفس الصفحة في كروم.');const u=location.origin+location.pathname.replace(/[^\/]*$/,'')+'owner-login.html';location.href=/Android/i.test(navigator.userAgent)?'intent://'+u.replace(/^https?:\/\//,'')+'#Intent;scheme=https;package=com.android.chrome;end':u;return;}try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){fail(e);}};
const oldOpen=window.openAdminDashboard;window.openAdminDashboard=()=>{if(owner)oldOpen();else openPinModal();};
window.ownerSignOut=async()=>{await signOut(auth);closeAdminDashboard();};
window.submitJoinRequest=async()=>{const b=document.querySelector('#joinForm button[type=submit]');if(b)b.disabled=true;try{const fields={category:'joinCategory',name:'joinName',specialty:'joinSpecialty',center:'joinCenter',governorate:'joinGovernorate',phone:'joinPhone',discount:'joinDiscount',address:'joinAddress',schedule:'joinSchedule',mapUrl:'joinMapUrl',notes:'joinNotes'},row={};for(const[k,v]of Object.entries(fields))row[k]=document.getElementById(v).value.trim();if(!safe(row)||!row.name||!row.phone)throw Error('invalid-input');const key=localStorage.getItem('raaya.request.key')||crypto.randomUUID();localStorage.setItem('raaya.request.key',key);await setDoc(doc(db,'requests',key),{...row,id:key,status:'pending',createdAt:serverTimestamp()});localStorage.removeItem('raaya.request.key');closeJoinModal();alert('تم إرسال طلبك للإدارة للمراجعة بنجاح.');}catch(e){fail(e);}finally{if(b)b.disabled=false;}};
window.approveJoinRequest=async id=>{if(!owner)return;try{await runTransaction(db,async t=>{const ref=doc(db,'requests',id),s=await t.get(ref);if(!s.exists())throw Error('missing-request');const r=s.data();const{id:old,status,createdAt,...data}=r;t.set(doc(db,'providers','provider-'+id),{...data,id:'provider-'+id,approved:true});t.delete(ref);});alert('تم اعتماد الجهة وإضافتها للدليل.');}catch(e){fail(e);}};
window.rejectJoinRequest=async id=>{if(!owner)return;try{const b=writeBatch(db);b.delete(doc(db,'requests',id));await b.commit();}catch(e){fail(e);}};
window.openMemberCardModal=()=>{if(!owner){alert('بطاقات العضوية خاصة. تواصل مع الإدارة للحصول على بطاقتك.');return;}document.getElementById('memberCardModal').classList.remove('hidden');};
window.importLegacyData=async()=>{if(!owner||!confirm('نقل بيانات هذا المتصفح إلى قاعدة البيانات المشتركة؟ لن يتم نقل السجلات الافتراضية.'))return;try{for(const[key,name,current]of [['fayoum_medical_directory_db','providers',providers],['fayoum_member_cards','members',members],['fayoum_join_requests','requests',requests]]){const old=JSON.parse(localStorage.getItem(key)||'[]').filter(x=>!x.seedRecord);if(old.length){const merged=[...current];for(const r of old)if(!merged.some(x=>x.id===r.id))merged.push(r);await persist(name,current,merged);}}alert('تم النقل. النسخة المحلية محفوظة على هذا المتصفح.');}catch(e){fail(e);}};
onAuthStateChanged(auth,async user=>{owner=!!user&&user.uid===OWNER_UID&&user.emailVerified;stops.forEach(s=>s());stops=[];members=[];requests=[];if(owner){stops.push(watch('members',x=>members=x),watch('requests',x=>requests=x));closePinModal();}else{closeAdminDashboard();if(user){await signOut(auth);alert('هذا الحساب ليس حساب الإدارة المصرح به.');}}refresh();});
watch('providers',x=>{providers=x;ready=true;document.getElementById('connectionStatus').textContent='متصل';},query(collection(db,'providers'),where('approved','==',true)));
window.addEventListener('offline',()=>document.getElementById('connectionStatus').textContent='غير متصل، لا يتم تأكيد أي حفظ');
window.addEventListener('online',()=>document.getElementById('connectionStatus').textContent='جارٍ الاتصال');
refresh();
