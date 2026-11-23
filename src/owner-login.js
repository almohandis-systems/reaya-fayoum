import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'firebase/auth';
import config from './firebase-config.json';
const auth=getAuth(initializeApp(config));
document.getElementById('login').onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){document.getElementById('status').textContent=e.code;}};
onAuthStateChanged(auth,user=>{document.getElementById('status').textContent=user?JSON.stringify({email:user.email,uid:user.uid,verified:user.emailVerified}):'سجّل الدخول بحساب Google الخاص بالإدارة';});
document.getElementById('logout').onclick=()=>signOut(auth);
