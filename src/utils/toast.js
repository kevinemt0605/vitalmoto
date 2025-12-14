export default function showToast(message, type = 'info'){
  try{
    const id = `toast_${Date.now()}`;
    let container = document.getElementById('app-toasts');
    if(!container){
      container = document.createElement('div');
      container.id = 'app-toasts';
      container.style.position = 'fixed';
      container.style.right = '16px';
      container.style.top = '16px';
      container.style.zIndex = 99999;
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '8px';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.id = id;
    el.className = `toast toast-${type}`;
    el.style.minWidth = '220px';
    el.style.maxWidth = '360px';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '8px';
    el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    el.style.color = '#fff';
    el.style.fontWeight = '600';
    el.style.opacity = '0';
    el.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
    el.style.transform = 'translateY(-6px)';
    el.innerText = message;
    switch(type){
      case 'success': el.style.background = 'linear-gradient(90deg,#27ae60,#2ecc71)'; break;
      case 'error': el.style.background = 'linear-gradient(90deg,#e74c3c,#c0392b)'; break;
      case 'warn': el.style.background = 'linear-gradient(90deg,#f39c12,#f1c40f)'; el.style.color='#111'; break;
      default: el.style.background = 'linear-gradient(90deg,#2980b9,#3498db)';
    }
    container.appendChild(el);
    // show
    requestAnimationFrame(()=>{
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    // auto remove
    setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(()=>{ try{ container.removeChild(el); }catch(e){} },300);
    },4000);
  }catch(e){ try{ alert(message) }catch(_){ /* ignore */ } }
}
