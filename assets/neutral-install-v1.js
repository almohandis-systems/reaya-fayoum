/* Install only through the browser-provided native prompt; never redirect to Chrome. */
(() => {
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function hint(text) {
    let el = document.getElementById('nativeInstallHint');
    if (!el) {
      el = document.createElement('div'); el.id='nativeInstallHint'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true');
      el.style.cssText='position:fixed;inset:0;z-index:99999;background:#052e16bb;display:flex;align-items:center;justify-content:center;padding:20px;direction:rtl';
      const box=document.createElement('div');box.style.cssText='background:white;color:#163b31;border-radius:22px;padding:24px;max-width:390px;line-height:1.9;box-shadow:0 15px 50px #0005';
      const p=document.createElement('p');p.id='nativeInstallHintText';p.style.marginBottom='16px';box.append(p);
      const close=document.createElement('button');close.textContent='حسنًا';close.style.cssText='border:0;border-radius:12px;padding:10px 24px;background:#047857;color:white;font-weight:bold';close.onclick=()=>el.remove();box.append(close);el.append(box);document.body.append(el);
    }
    document.getElementById('nativeInstallHintText').textContent=text;
  }
  window.handleSmartInstall=async function(){
    if(standalone()){hint('التطبيق مثبت بالفعل على هذا الجهاز.');return;}
    if(deferredPrompt){
      const prompt=deferredPrompt;deferredPrompt=null;
      try{await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted')dismissBottomBanner();}
      catch{hint('تعذر فتح نافذة التثبيت الآن. جرّب مرة أخرى من قائمة المتصفح.');}
      return;
    }
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    if(ios){hint('على آيفون أو آيباد في Safari: اضغط مشاركة، ثم إضافة إلى الشاشة الرئيسية. لا يتيح النظام التثبيت المباشر من هذا الزر.');return;}
    hint('نافذة التثبيت غير متاحة الآن في هذا المتصفح. إذا ظهر خيار تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية في قائمته، استخدمه. بعض المتصفحات الداخلية لا تدعم التثبيت.');
  };
  window.installPWA=()=>window.handleSmartInstall();
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;dismissBottomBanner();document.getElementById('nativeInstallHint')?.remove();});
})();
