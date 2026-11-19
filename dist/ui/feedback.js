'use strict';

const toast = document.querySelector('#toast');
let toastTimer;

function tell(message, error = false) {
  toast.classList.toggle('error', error);
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 5200);
}
