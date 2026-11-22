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

  /* ---- Owner design cloud sync (Firestore: crash-os-menu / designs/{instance}) ----
     Visitors read the shared design live; the owner publishes from this panel.
     Firebase Auth manages the owner session (nothing is stored by this script).
     If the cloud refuses, the local per-device choice keeps working. */
  try{localStorage.removeItem('owner_cloud_auth_v1');}catch(_){} /* one-time v1 cleanup; all other local data stays */
  const pageSlug=(function(){try{let f=decodeURIComponent(location.pathname).split('/').pop()||'index';f=f.replace(/\.html?$/i,'').replace(/[^a-z0-9]+/gi,'');return f||'index';}catch(_){return 'index';}})();
  const FIELD='reaya_'+pageSlug;
  const CFG={apiKey:"AIzaSyBLPjxVM_GOtpdsj1B4a_QvNnq78rPJLMg",authDomain:"crash-os-menu.firebaseapp.com",projectId:"crash-os-menu",storageBucket:"crash-os-menu.firebasestorage.app",messagingSenderId:"464164737437",appId:"1:464164737437:web:5a4accfdbb15fb00e7df74"};
  let syncHost=null;
  function syncStatus(m){const e=document.getElementById('design-sync-status');if(e)e.textContent=m;}
  function initFb(){try{if(typeof firebase==='undefined')return false;if(!firebase.apps.length)firebase.initializeApp(CFG);return true;}catch(e){return false;}}
  function getDb(){try{return (initFb()&&firebase.firestore)?firebase.firestore():null;}catch(e){return null;}}
  function getAuth(){try{return (initFb()&&firebase.auth)?firebase.auth():null;}catch(e){return null;}}
  function pushDesign(value){
    const a=getAuth();
    if(!a||!a.currentUser){syncStatus('📴 التصميم اتحفظ على جهازك بس. سجّل دخول المالك تحت مرة واحدة عشان يظهر لكل العملاء.');return;}
    const d=getDb();if(!d){syncStatus('📴 التصميم اتحفظ على جهازك بس.');return;}
    const uid=a.currentUser.uid;
    const ref=d.collection('designs').doc(FIELD);
    ref.get().then(function(snap){
      if(snap.exists&&snap.data().ownerUid&&snap.data().ownerUid!==uid){
        syncStatus('⚠️ نسخة التطبيق دي متسجلة لحساب مالك تاني — الحساب ده ماتقدرش يغير تصميمها.');
        return;
      }
      ref.set({ownerUid:uid,value:value,updatedAt:Date.now()}).then(function(){
        syncStatus('☁️ تم! التصميم بقى مشترك وظاهر لكل العملاء ✓');
      },function(){
        syncStatus('⚠️ اتحفظ على جهازك بس — السحابة رافضة الكتابة لحد ما المزامنة تتفعل (خطوة مرة واحدة).');
      });
    },function(){
      syncStatus('⚠️ اتحفظ على جهازك بس — المزامنة لسه مش مفعلة (خطوة مرة واحدة من لوحة Firebase).');
    });
  }
  function renderSyncUI(){
    if(!syncHost)return;
    const old=document.getElementById('design-sync-ui');if(old)old.remove();
    const a=getAuth();
    const user=a&&a.currentUser;
    const w=document.createElement('div');
    w.id='design-sync-ui';
    w.style.cssText='margin-top:10px;padding:10px;border:1px dashed rgba(245,158,11,.45);border-radius:12px;font-size:13px;line-height:1.7;text-align:right';
    if(user){
      w.innerHTML='<div id="design-sync-status" style="font-weight:700">☁️ المزامنة مفعلة بحساب المالك — أي تصميم تختاره يظهر لكل العملاء.</div>'+
        '<button id="ds-logout-btn" type="button" style="margin-top:6px;padding:5px 12px;border-radius:8px;background:transparent;color:#b45309;border:1px solid #b45309;cursor:pointer;font-size:12px">تسجيل خروج المالك</button>';
      syncHost.appendChild(w);
      w.querySelector('#ds-logout-btn').addEventListener('click',function(){a.signOut().then(renderSyncUI);});
    }else{
      w.innerHTML='<div id="design-sync-status" style="margin-bottom:6px;font-weight:700">📴 حاليًا التصميم بيتحفظ على كل جهاز لوحده. سجّل دخولك كمالك مرة واحدة عشان اختيارك يظهر عند كل العملاء.</div>'+
        '<div><input id="ds-email" type="email" autocomplete="username" placeholder="بريد المالك" style="width:100%;margin-bottom:6px;padding:6px;border-radius:8px;border:1px solid #94a3b8;font-size:13px">'+
        '<input id="ds-pass" type="password" autocomplete="current-password" placeholder="كلمة المرور" style="width:100%;margin-bottom:6px;padding:6px;border-radius:8px;border:1px solid #94a3b8;font-size:13px">'+
        '<button id="ds-login-btn" type="button" style="padding:7px 14px;border-radius:8px;background:#d97706;color:#040711;font-weight:800;border:0;cursor:pointer;font-size:13px">تفعيل المزامنة لكل العملاء</button></div>';
      syncHost.appendChild(w);
      w.querySelector('#ds-login-btn').addEventListener('click',function(){
        const em=w.querySelector('#ds-email').value.trim(),pw=w.querySelector('#ds-pass').value;
        if(!em||!pw){syncStatus('اكتب البريد وكلمة المرور الأول.');return;}
        const au=getAuth();if(!au){syncStatus('⚠️ المصادقة مش متاحة دلوقتي.');return;}
        syncStatus('⏳ جاري تسجيل الدخول...');
        au.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(function(){
          return au.signInWithEmailAndPassword(em,pw);
        }).then(function(){
          renderSyncUI();
        },function(){
          syncStatus('⚠️ الدخول فشل — تأكد من البيانات، أو إن المصادقة اتفعلت من لوحة Firebase.');
        });
      });
    }
  }
  function mountSyncUI(){
    document.querySelectorAll('[data-owner-design-panel]').forEach(function(panel){
      syncHost=panel;
      renderSyncUI();
    });
  }
  function subscribeCloud(){
    const d=getDb();if(!d)return;
    try{
      d.collection('designs').doc(FIELD).onSnapshot(function(snap){
        const data=snap.exists?snap.data():null;
        const v=data?data.value:null;
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
    loadFirebaseScripts(function(){
      subscribeCloud();
      const a=getAuth();if(a)a.onAuthStateChanged(function(){renderSyncUI();});
    });
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
