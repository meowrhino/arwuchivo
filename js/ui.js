export function setupOverlay() {
  const overlay = document.getElementById("overlay");
  const overlayBody = document.getElementById("overlayBody");
  const closeBtn = document.getElementById("overlayClose");

  function close() {
    overlay.hidden = true;
    overlayBody.innerHTML = "";
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener("click", close);

  return {
    openVideo(src) {
      overlay.hidden = false;
      overlayBody.innerHTML = "";
      const v = document.createElement("video");
      v.controls = true;
      v.playsInline = true;
      v.src = src;
      overlayBody.appendChild(v);
      v.play().catch(() => {});
    },
    openPassword({ onSubmit }) {
      overlay.hidden = false;
      overlayBody.innerHTML = "";

      const wrap = document.createElement("div");
      wrap.className = "modal";

      const label = document.createElement("label");
      label.textContent = "Contraseña";
      const input = document.createElement("input");
      input.type = "password";
      input.autocomplete = "off";
      input.placeholder = "Escribe la contraseña…";

      const msg = document.createElement("div");
      msg.className = "msg";
      msg.hidden = true;

      const row = document.createElement("div");
      row.className = "row";

      const cancel = document.createElement("button");
      cancel.className = "btn";
      cancel.type = "button";
      cancel.textContent = "Cancelar";

      const ok = document.createElement("button");
      ok.className = "btn primary";
      ok.type = "button";
      ok.textContent = "Entrar";

      row.append(cancel, ok);
      wrap.append(label, input, msg, row);
      overlayBody.appendChild(wrap);

      cancel.addEventListener("click", () => {
        overlay.hidden = true;
        overlayBody.innerHTML = "";
      });

      const submit = () => {
        const val = input.value ?? "";
        const result = onSubmit(val);
        if (result === true) {
          // quien llama se encarga de abrir el vídeo
          overlay.hidden = true;
          overlayBody.innerHTML = "";
          return;
        }
        msg.textContent = "Contraseña equivocada, intenta de nuevo";
        msg.hidden = false;
        input.select();
      };

      ok.addEventListener("click", submit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });

      setTimeout(() => input.focus(), 50);
    }
  };
}
