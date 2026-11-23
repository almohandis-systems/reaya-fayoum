/* Owner entry only. Database authorization remains the fixed verified owner UID. */
(() => {
  const loginUrl=new URL('owner-login.html',location.href).href;
  const fallback=document.querySelector('#pinModal button[onclick="verifyPin()"]');
  if(fallback){fallback.textContent='الدخول إلى حساب المالك';fallback.onclick=()=>location.assign(loginUrl);}
  const modal=document.getElementById('pinModal');
  if(modal){const a=document.createElement('a');a.href=loginUrl;a.textContent='الدخول بالإيميل والرقم السري';a.style.cssText='display:block;text-align:center;padding:14px;color:#047857;font-weight:bold';modal.firstElementChild?.append(a);}
  const panel=document.getElementById('adminDashboard');
  if(panel){const a=document.createElement('a');a.href=new URL('owner-login.html?mode=change',location.href).href;a.textContent='تغيير الرقم السري';a.style.cssText='display:inline-block;background:#047857;color:white;padding:12px;border-radius:12px;margin:12px';panel.firstElementChild?.prepend(a);}
  if(location.hash!=='#owner')return;
  const notice=document.createElement('p');notice.setAttribute('role','status');notice.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;background:white;color:#064e3b;padding:18px;border:1px solid #a7c9b8;border-radius:14px;z-index:10000;text-align:center';notice.textContent='جارٍ التحقق من حساب المالك لفتح لوحة الإدارة…';document.body.append(notice);
  let attempts=0;const timer=setInterval(()=>{attempts++;if(window.raayaContentStore?.isOwner()){clearInterval(timer);notice.remove();window.openAdminDashboard();}else if(attempts>=80){clearInterval(timer);notice.textContent='لم يكتمل التحقق من جلسة المالك. ';const a=document.createElement('a');a.href=loginUrl;a.textContent='العودة إلى تسجيل الدخول';notice.append(a);}},250);
})();
