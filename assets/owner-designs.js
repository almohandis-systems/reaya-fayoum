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
  document.addEventListener('DOMContentLoaded',function(){
    apply(current);
    document.querySelectorAll('[data-owner-design-save]').forEach(button=>button.addEventListener('click',function(){
      const panel=button.closest('[data-owner-design-panel]');
      const value=panel.querySelector('[data-owner-design-select]').value;
      apply(value);
      const status=panel.querySelector('[data-owner-design-status]');
      try{localStorage.setItem(key,value);status.textContent='تم تطبيق '+labels[value]+' وحفظه لهذا الجهاز وهذه الصفحة فقط.';}
      catch(_){status.textContent='تم تطبيق التصميم الآن، لكن المتصفح منع الحفظ. قد يرجع التصميم بعد إعادة الفتح.';}
    }));
    document.querySelectorAll('[data-owner-design-reset]').forEach(button=>button.addEventListener('click',function(){
      apply('original');
      const status=button.closest('[data-owner-design-panel]').querySelector('[data-owner-design-status]');
      try{localStorage.setItem(key,'original');status.textContent='رجع التصميم الأصلي مع الاحتفاظ بإصلاحات التشغيل. الاختيار محفوظ على هذا الجهاز فقط.';}
      catch(_){status.textContent='رجع التصميم الأصلي الآن، لكن المتصفح منع حفظ الاختيار.';}
    }));
    document.querySelectorAll('[data-owner-design-open]').forEach(button=>button.addEventListener('click',function(){
      const dialog=document.getElementById('owner-design-dialog');if(dialog){dialog.showModal();}
    }));
    document.querySelectorAll('[data-owner-design-close]').forEach(button=>button.addEventListener('click',function(){button.closest('dialog').close();}));
  });
})();
