# Trofeu Espelho

Espelha a tela do iPhone no PC Windows **pelo cabo (padrão) ou Wi‑Fi**. Não usa AirPlay — a captura é feita por transmissão de tela do iOS (mesmo método do ApowerMirror), então vídeos do TikTok aparecem normalmente.

## Peças
- `pc/` — app do Windows (Electron). Já vem pronto em **TrofeuEspelho-Windows.zip**.
- `ios/` — app do iPhone + extensão de transmissão (Swift).
- `.github/workflows/ios.yml` — gera o arquivo do iPhone (.ipa) de graça no GitHub.

## 1. PC
1. Extraia `TrofeuEspelho-Windows.zip` e abra **Trofeu Espelho.exe**.
2. Para o cabo funcionar o Windows precisa do driver da Apple: app **Dispositivos Apple** (Microsoft Store) ou **iTunes**. Se o ApowerMirror já funciona no cabo, já está instalado.

## 2. iPhone (uma vez)
1. Crie uma conta no github.com → **New repository** (privado) → envie todo o conteúdo desta pasta (menos os .zip).
2. Aba **Actions** → "Gerar app do iPhone (IPA)" roda sozinho (~5 min) → baixe **TrofeuEspelho-iPhone** e extraia o `.ipa`.
3. Instale o **Sideloadly** no PC, conecte o iPhone, arraste o `.ipa` e entre com seu Apple ID.
4. No iPhone: Ajustes → Geral → VPN e Gerenciamento de Dispositivo → confiar no seu Apple ID. Ative o **Modo de Desenvolvedor** se pedir.
   - Com Apple ID grátis o app vale 7 dias; é só reinstalar pelo Sideloadly (ele pode renovar sozinho). Com conta de desenvolvedor paga (US$ 99/ano) vale 1 ano.

## Uso
- **Cabo:** conecte, toque em Confiar → no PC clique **Conexão de USB** → no iPhone abra o Trofeu Espelho → **Iniciar espelhamento → Iniciar Transmissão**. Se o cabo sair, o PC volta a conectar sozinho quando a transmissão estiver ativa.
- **Wi‑Fi:** mesma rede → **Conexão de Wi‑Fi** → inicie a transmissão no iPhone → clique em Conectar (ou digite o IP mostrado no app).

## Atalhos
F11 tela cheia · Ctrl+S captura · Ctrl+R gravar (MP4) · Ctrl+D desenhar · Ctrl+T sempre no topo · Ctrl+Shift+R girar · Espaço pausar · Ctrl+roda tamanho.

## Onde mexer
- Visual e telas: `pc/ui/index.html`, `pc/ui/app.css`, ícones em `pc/ui/icons.js`.
- Configurações (padrões): `DEFAULTS` em `pc/main.js`; páginas de configuração em `PAGES` no `pc/ui/app.js`.
- Qualidade da captura no iPhone: `ios/Broadcast/SampleHandler.swift` (resolução, FPS e Mbps também mudam pelo PC).
- Para testar o PC a partir do código: `npm install` e `npm start` dentro de `pc/`.
