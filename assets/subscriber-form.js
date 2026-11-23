(()=>{'use strict';
const form=document.querySelector('#subscriberFormModal form');if(!form)return;
const fields=[...form.querySelectorAll('[data-family-member]')];
const sync=()=>{form.elements.family.value=fields.map(input=>input.value.trim()).filter(Boolean).join('\n');};
form.addEventListener('input',sync);
// Capture runs before the existing inline submit handler reads FormData.
form.addEventListener('submit',sync,true);
form.addEventListener('reset',()=>{queueMicrotask(sync);});
})();
