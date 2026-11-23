
// Owner-controlled interface copy. The database enforces the same fixed owner UID.
window.raayaContentStore={current:{},isOwner:()=>Se,save:async values=>{
 if(!Se)throw Error('owner-only');
 await Yf(Qe(Ee,'appContent','interface'),{version:1,texts:JSON.stringify(values),updatedAt:Va()});
}};
Cy(Qe(Ee,'appContent','interface'),snapshot=>{
 let values={};try{const data=snapshot.exists()?snapshot.data():null;values=data?JSON.parse(data.texts):{};}catch(e){console.error('Invalid interface text document');}
 window.raayaContentStore.current=values;
 window.dispatchEvent(new CustomEvent('raaya-content-update',{detail:values}));
},error=>{console.error('Interface copy unavailable',error.code);const status=document.getElementById('contentEditorStatus');if(status)status.textContent='تعذر تحميل النصوص المشتركة. لم يتم تأكيد أي حفظ.';});
const oldSettings=window.openAdvancedSettingsModal;
window.openAdvancedSettingsModal=()=>{if(Se)oldSettings();else openPinModal();};
const oldSettingsSave=window.saveSiteSettings;
window.saveSiteSettings=()=>{if(!Se)return;alert('استخدم مكتبة نصوص التطبيق للحفظ والنشر لكل الزوار.');};
