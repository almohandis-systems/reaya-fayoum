/* Owner-selected appearance. No customer, order, member or balance data is changed. */
(function(){
  'use strict';
  const allowed=['original','cinematic','midnight','ivory'];
  const labels={original:'الأصلي',cinematic:'الزمرد السينمائي',midnight:'ليلي أزرق',ivory:'عاجي تحريري'};
  const key='reaya.ownerDesign.v1:'+location.pathname;
  let current='cinematic';
  try{const saved=localStorage.getItem(key);if(allowed.includes(saved))current=saved;}catch(_){}
  function apply(value){
    if(!allowed.includes(value))return;
    current=value;document.documentElement.dataset.ownerDesign=value;
    for(const id of ['reaya-cinema-v2','royal-cinema-v2','royal-product-v2']){
      const sheet=document.getElementById(id);if(sheet)sheet.disabled=value==='original';
    }
    document.querySelectorAll('[data-owner-design-select]').forEach(x=>{x.value=value;});
    document.querySelectorAll('[data-owner-design-current]').forEach(x=>{x.textContent=labels[value];});
  }
  apply(current);

  /* ---- Owner design cloud sync (Firestore: crash-os-menu / settings/owner_designs) ----
     Visitors read the shared design live; the owner publishes from this panel.
     If the cloud refuses, the local per-device choice keeps working. */
  const pageSlug=(function(){try{let f=decodeURIComponent(location.pathname).split('/').pop()||'index';f=f.replace(/\.html?$/i,'').replace(/[^a-z0-9]+/gi,'');return f||'index';}catch(_){return 'index';}})();
  const FIELD='reaya_'+pageSlug;
  const AUTH_KEY='owner_cloud_auth_v1';
  const CFG={apiKey:"AIzaSyBLPjxVM_GOtpdsj1B4a_QvNnq78rPJLMg",authDomain:"crash-os-menu.firebaseapp.com",projectId:"crash-os-menu",storageBucket:"crash-os-menu.firebasestorage.app",messagingSenderId:"464164737437",appId:"1:464164737437:web:5a4accfdbb15fb00e7df74"};
  function syncStatus(m){const e=document.getElementById('design-sync-status');if(e)e.textContent=m;}
  function getDb(){try{if(typeof firebase==='undefined'||!firebase.firestore)return null;if(!firebase.apps.length)firebase.initializeApp(CFG);return firebase.firestore();}catch(e){return null;}}
  function creds(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null');}catch(e){return null;}}
  function signIn(cb){
    const c=creds();
    if(!c||!c.email||!c.pass){cb(false,'no-creds');return;}
    try{
      const a=firebase.auth();
      if(a.currentUser){cb(true);return;}
      a.signInWithEmailAndPassword(c.email,c.pass).then(()=>cb(true),()=>cb(false,'bad-creds'));
    }catch(e){cb(false,'err');}
  }
  function pushDesign(value){
    signIn(function(ok,why){
      if(!ok){syncStatus(why==='no-creds'?'📴 التصميم اتحفظ على جهازك بس. سجّل دخول المالك تحت مرة واحدة عشان يظهر لكل العملاء.':'⚠️ اتحفظ على جهازك بس — بيانات دخول المالك مش سليمة.');return;}
      const d=getDb();if(!d){syncStatus('📴 التصميم اتحفظ على جهازك بس.');return;}
      const upd={};upd[FIELD]=value;upd[FIELD+'_at']=Date.now();
      d.collection('settings').doc('owner_designs').set(upd,{merge:true}).then(function(){
        syncStatus('☁️ تم! التصميم بقى مشترك وظاهر لكل العملاء ✓');
      },function(){
        syncStatus('⚠️ اتحفظ على جهازك بس — السحابة رافضة الكتابة لحد ما قواعد Firebase تتفعل (خطوة مرة واحدة).');
      });
    });
  }
  function mountSyncUI(){
    document.querySelectorAll('[data-owner-design-panel]').forEach(function(panel){
      if(panel.querySelector('#design-sync-ui'))return;
      const w=document.createElement('div');
      w.id='design-sync-ui';
      w.style.cssText='margin-top:10px;padding:10px;border:1px dashed rgba(245,158,11,.45);border-radius:12px;font-size:13px;line-height:1.7;text-align:right';
      w.innerHTML='<div id="design-sync-status" style="margin-bottom:6px;font-weight:700"></div>'+
        '<div><input id="ds-email" type="email" placeholder="بريد المالك" style="width:100%;margin-bottom:6px;padding:6px;border-radius:8px;border:1px solid #94a3b8;font-size:13px">'+
        '<input id="ds-pass" type="password" placeholder="كلمة المرور" style="width:100%;margin-bottom:6px;padding:6px;border-radius:8px;border:1px solid #94a3b8;font-size:13px">'+
        '<button id="ds-login-btn" type="button" style="padding:7px 14px;border-radius:8px;background:#d97706;color:#040711;font-weight:800;border:0;cursor:pointer;font-size:13px">تفعيل المزامنة لكل العملاء</button></div>';
      panel.appendChild(w);
      syncStatus(creds()?'☁️ المزامنة مفعلة على جهازك — أي تصميم تختاره يظهر لكل العملاء.':'📴 حاليًا التصميم بيتحفظ على كل جهاز لوحده. سجّل دخولك كمالك مرة واحدة عشان اختيارك يظهر عند كل العملاء.');
      w.querySelector('#ds-login-btn').addEventListener('click',function(){
        const em=w.querySelector('#ds-email').value.trim(),pw=w.querySelector('#ds-pass').value;
        if(!em||!pw){syncStatus('اكتب البريد وكلمة المرور الأول.');return;}
        try{localStorage.setItem(AUTH_KEY,JSON.stringify({email:em,pass:pw}));}catch(_){}
        signIn(function(ok){
          if(ok){syncStatus('☁️ تم تفعيل المزامنة ✓ — أي تصميم تختاره من دلوقتي يتطبق عند كل العملاء.');}
          else{try{localStorage.removeItem(AUTH_KEY);}catch(_){}syncStatus('⚠️ الدخول فشل — تأكد من البيانات، أو إن المصادقة اتفعلت من لوحة Firebase.');}
        });
      });
    });
  }
  function subscribeCloud(){
    const d=getDb();if(!d)return;
    try{
      d.collection('settings').doc('owner_designs').onSnapshot(function(snap){
        const data=snap.exists?snap.data():null;
        const v=data?data[FIELD]:null;
        if(v&&allowed.includes(v)){
          current=v;try{localStorage.setItem(key,v);}catch(_){}
          apply(v);
        }
      },function(){/* cloud refused: local design keeps working */});
    }catch(e){}
  }
  function loadFirebaseScripts(done){
    const urls=[
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
      'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js'
    ];
    let i=0;
    (function next(){
      if(i>=urls.length){done();return;}
      const s=document.createElement('script');
      s.src=urls[i++];s.onload=next;s.onerror=next;
      document.head.appendChild(s);
    })();
  }

  document.addEventListener('DOMContentLoaded',function(){
    apply(current);
    mountSyncUI();
    loadFirebaseScripts(subscribeCloud);
    document.querySelectorAll('[data-owner-design-save]').forEach(button=>button.addEventListener('click',function(){
      const panel=button.closest('[data-owner-design-panel]');
      const value=panel.querySelector('[data-owner-design-select]').value;
      apply(value);
      const status=panel.querySelector('[data-owner-design-status]');
      try{localStorage.setItem(key,value);status.textContent='تم تطبيق '+labels[value]+' وحفظه لهذا الجهاز وهذه الصفحة فقط.';}
      catch(_){status.textContent='تم تطبيق التصميم الآن، لكن المتصفح منع الحفظ. قد يرجع التصميم بعد إعادة الفتح.';}
      pushDesign(value);
    }));
    document.querySelectorAll('[data-owner-design-reset]').forEach(button=>button.addEventListener('click',function(){
      apply('original');
      const status=button.closest('[data-owner-design-panel]').querySelector('[data-owner-design-status]');
      try{localStorage.setItem(key,'original');status.textContent='رجع التصميم الأصلي مع الاحتفاظ بإصلاحات التشغيل. الاختيار محفوظ على هذا الجهاز فقط.';}
      catch(_){status.textContent='رجع التصميم الأصلي الآن، لكن المتصفح منع حفظ الاختيار.';}
      pushDesign('original');
    }));
    document.querySelectorAll('[data-owner-design-open]').forEach(button=>button.addEventListener('click',function(){
      const dialog=document.getElementById('owner-design-dialog');if(dialog){dialog.showModal();}
    }));
    document.querySelectorAll('[data-owner-design-close]').forEach(button=>button.addEventListener('click',function(){button.closest('dialog').close();}));
  });
})();
