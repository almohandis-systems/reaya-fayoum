import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'firebase/auth';
import {getFirestore,collection,doc,onSnapshot,query,where,writeBatch,setDoc,serverTimestamp,runTransaction,getDocs} from 'firebase/firestore';
import config from './firebase-config.json';
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
const OWNER_UID='CWo2ULEH4oZviK7VXgrFP9e45Sz1';
let providers=[],members=[],requests=[],owner=false,ready=false,stops=[];
const localItems=window.getItems,localMembers=window.getMemberCards,localRequests=window.getJoinRequests,saveLocalRequests=window.saveJoinRequests,saveLocalItems=window.saveItems;
const clone=x=>JSON.parse(JSON.stringify(x));
const safe=x=>typeof x==='string'?!/[<>"'`\\&]/.test(x)&&x.length<=2000:Array.isArray(x)?x.every(safe):x&&typeof x==='object'?Object.values(x).every(safe):true;
const fail=e=>{console.error(e.code||e.message);document.getElementById('connectionStatus').textContent='تعذر الاتصال';alert('تعذر إتمام العملية. تحقق من الاتصال والصلاحيات وحاول مجدداً.');};
function refresh(){populateCentersSelectors();updateCategoryCounts();renderCards();renderAdminTable();renderMembersTable();renderRequestsTable();calculateStats();}
function watch(name,assign,q){return onSnapshot(q||collection(db,name),s=>{assign(s.docs.map(d=>({...d.data(),id:d.id})));refresh();},fail);}
// Provider directory is unchanged during delivery hotfix.
window.getItems=localItems;
window.getMemberCards=()=>owner?localMembers():[];
window.getJoinRequests=()=>owner?[...clone(requests),...localRequests().filter(r=>!requests.some(q=>q.id===r.id)).map(r=>({...r,localOnly:true}))]:[];
async function persist(name,before,after){if(!owner)throw Error('owner-only');if(!safe(after))throw Error('invalid-characters');const batch=writeBatch(db),ids=new Set(after.map(r=>r.id));for(const row of before)if(!ids.has(row.id))batch.delete(doc(db,name,row.id));for(const row of after)if(JSON.stringify(before.find(r=>r.id===row.id))!==JSON.stringify(row))batch.set(doc(db,name,row.id),name==='providers'?{...row,approved:true}:row);await batch.commit();}


window.saveJoinRequests=async rows=>{await persist('requests',requests,rows);};
window.openPinModal=()=>{if(owner)return openAdminDashboard();document.getElementById('pinModal').classList.remove('hidden');};
window.verifyPin=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){fail(e);}};
const oldOpen=window.openAdminDashboard;window.openAdminDashboard=()=>{if(owner)oldOpen();else openPinModal();};
window.ownerSignOut=async()=>{await signOut(auth);closeAdminDashboard();};
window.submitJoinRequest=async()=>{const b=document.querySelector('#joinForm button[type=submit]');if(b)b.disabled=true;try{const fields={category:'joinCategory',name:'joinName',specialty:'joinSpecialty',center:'joinCenter',governorate:'joinGovernorate',phone:'joinPhone',discount:'joinDiscount',address:'joinAddress',schedule:'joinSchedule',mapUrl:'joinMapUrl',notes:'joinNotes'},row={};for(const[k,v]of Object.entries(fields))row[k]=document.getElementById(v).value.trim();if(!safe(row)||!row.name||!row.phone)throw Error('invalid-input');const key=localStorage.getItem('raaya.request.key')||crypto.randomUUID();localStorage.setItem('raaya.request.key',key);await setDoc(doc(db,'requests',key),{...row,id:key,status:'pending',createdAt:serverTimestamp()});localStorage.removeItem('raaya.request.key');closeJoinModal();alert('تم إرسال طلبك للإدارة للمراجعة بنجاح.');}catch(e){fail(e);}finally{if(b)b.disabled=false;}};
function askAction(message, action){const modal=document.createElement('div');modal.className='fixed inset-0 bg-slate-900/70 z-[100] flex items-center justify-center p-4';const box=document.createElement('div');box.className='bg-white p-6 rounded-2xl max-w-sm w-full text-center';const text=document.createElement('p');text.textContent=message;const yes=document.createElement('button'),no=document.createElement('button');yes.textContent='تأكيد';no.textContent='إلغاء';yes.className='bg-rose-600 text-white p-3 rounded-xl m-2';no.className='bg-slate-100 p-3 rounded-xl m-2';yes.onclick=async()=>{yes.disabled=true;try{await action();modal.remove();}catch(e){yes.disabled=false;fail(e);}};no.onclick=()=>modal.remove();box.append(text,yes,no);modal.append(box);document.body.append(modal);}
async function removeRequest(id){const local=localRequests().some(r=>r.id===id);if(local)saveLocalRequests(localRequests().filter(r=>r.id!==id));if(requests.some(r=>r.id===id)){const b=writeBatch(db);b.delete(doc(db,'requests',id));await b.commit();}renderRequestsTable();}
window.approveJoinRequest=id=>{if(!owner)return;const req=getJoinRequests().find(r=>r.id===id);if(!req)return;askAction('اعتماد الطلب وإضافة الجهة إلى دليل هذا المتصفح؟',async()=>{const {status,createdAt,localOnly,...data}=req;saveLocalItems([{...data,id:'provider-'+id},...localItems()]);await removeRequest(id);});};
window.rejectJoinRequest=id=>{if(owner)askAction('رفض الطلب وإزالته من قائمة الانتظار؟',()=>removeRequest(id));};
window.deleteJoinRequest=id=>{if(owner)askAction('حذف هذا الطلب نهائياً؟ لا يمكن التراجع.',()=>removeRequest(id));};
const oldRender=window.renderRequestsTable;window.renderRequestsTable=()=>{oldRender();document.querySelectorAll('#requestsTableBody tr').forEach((row,i)=>{const r=getJoinRequests()[i];if(!r)return;const td=row.lastElementChild;if(td&&!td.querySelector('[data-delete-request]')){const b=document.createElement('button');b.dataset.deleteRequest='1';b.textContent='حذف';b.className='px-2 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold m-1';b.onclick=()=>deleteJoinRequest(r.id);td.append(b);}});};
window.openMemberCardModal=()=>{if(!owner){alert('بطاقات العضوية خاصة. تواصل مع الإدارة للحصول على بطاقتك.');return;}document.getElementById('memberCardModal').classList.remove('hidden');};
window.importLegacyData=async()=>{if(!owner||!confirm('نقل بيانات هذا المتصفح إلى قاعدة البيانات المشتركة؟ لن يتم نقل السجلات الافتراضية.'))return;try{for(const[key,name,current]of [['fayoum_medical_directory_db','providers',providers],['fayoum_member_cards','members',members],['fayoum_join_requests','requests',requests]]){const old=JSON.parse(localStorage.getItem(key)||'[]').filter(x=>!x.seedRecord);if(old.length){const merged=[...current];for(const r of old)if(!merged.some(x=>x.id===r.id))merged.push(r);await persist(name,current,merged);}}alert('تم النقل. النسخة المحلية محفوظة على هذا المتصفح.');}catch(e){fail(e);}};
onAuthStateChanged(auth,async user=>{owner=!!user&&user.uid===OWNER_UID&&user.emailVerified;stops.forEach(s=>s());stops=[];members=[];requests=[];if(owner){stops.push(watch('requests',x=>requests=x));closePinModal();}else{closeAdminDashboard();if(user){await signOut(auth);alert('هذا الحساب ليس حساب الإدارة المصرح به.');}}refresh();});
document.getElementById('connectionStatus').textContent='طلبات الانضمام متصلة بالإدارة';
window.addEventListener('offline',()=>document.getElementById('connectionStatus').textContent='غير متصل، لا يتم تأكيد أي حفظ');
window.addEventListener('online',()=>document.getElementById('connectionStatus').textContent='جارٍ الاتصال');
refresh();
