const { resolve, basename } = require('path');
const {
  app, Menu, Tray, dialog, Notification,
} = require('electron');

const AutoLaunch = require('auto-launch');

const axios = require('axios');

const { spawn } = require('child_process');
const fixPath = require('fix-path');
const fs = require('fs');

const Store = require('electron-store');

fixPath();

const schema = {
  projects: {
    type: 'string',
  },
  initLogin: {
    type: 'boolean',
    default: false,
  },
};

let mainTray = {};

const store = new Store({ schema });

let alConfig = { name: 'Code Tray', isHidden: true };

if (process.execPath) {
  alConfig = Object.assign(alConfig, { path: process.execPath });
}
const autoLauncher = new AutoLaunch(alConfig);

if (app.dock) {
  app.dock.hide();
}

function callNotification(title, body) {
  const iconAddress = resolve(__dirname, 'assets', 'iconTemplate.png');
  const notif = { title, body, icon: iconAddress };
  new Notification(notif).show();
}

function getBTC() {
  axios.get('https://api.bitcointrade.com.br/v3/public/BRLBTC/ticker')
    .then((res) => {
      const price = res.data.data.buy.toLocaleString('pt-BR');
      callNotification('Valor do Bitcoin', `R$ ${price}`);
    });
}

function getLocale() {
  const locale = app.getLocale();

  switch (locale) {
    case 'es-419' || 'es':
      return JSON.parse(fs.readFileSync(resolve(__dirname, 'locale/es.json')));
    case 'pt-BR' || 'pt-PT':
      return JSON.parse(fs.readFileSync(resolve(__dirname, 'locale/pt.json')));
    default:
      return JSON.parse(fs.readFileSync(resolve(__dirname, 'locale/en.json')));
  }
}

function sendError(p) {
  const locale = getLocale();

  p.stderr.on('data', (data) => {
    callNotification(locale.error, data.toString());
  });
}

function setAutoLogon(auto) {
  store.set('initLogin', auto);

  autoLauncher.isEnabled()
    .then((isEnabled) => {
      if (isEnabled && auto) return;

      if (isEnabled && !auto) autoLauncher.disable();

      if (!isEnabled && auto) autoLauncher.enable();
    });
}

function render(tray = mainTray) {
  const storedProjects = store.get('projects');
  const initLogin = store.get('initLogin');
  const projects = storedProjects ? JSON.parse(storedProjects) : [];
  const locale = getLocale();
  setAutoLogon(initLogin);

  const items = projects.map(({ name, path }) => ({
    label: name,
    submenu: [
      {
        label: locale.openCode,
        click: () => {
          const p = spawn('code', [path], { shell: true });
          sendError(p);
          getBTC();
        },
      },
      {
        label: locale.openSub,
        click: () => {
          const p = spawn('subl', [path], { shell: true });
          sendError(p);
          getBTC();
        },
      },
      {
        label: locale.openPhp,
        click: () => {
          const p = spawn('pstorm', [path], { shell: true });
          sendError(p);
          getBTC();
        },
      },
      {
        label: locale.remove,
        click: () => {
          store.set('projects', JSON.stringify(projects.filter(item => item.path !== path)));
          render();
        },
      },
    ],
  }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: locale.add,
      click: () => {
        const result = dialog.showOpenDialog({ properties: ['openDirectory'] });

        if (!result) return;

        const [path] = result;
        const name = basename(path);

        store.set(
          'projects',
          JSON.stringify([
            ...projects,
            {
              path,
              name,
            },
          ]),
        );

        render();
      },
    },
    {
      type: 'separator',
    },
    ...items,
    {
      type: 'separator',
    },
    {
      label: 'Iniciar no Login',
      type: 'checkbox',
      checked: initLogin,
      click(item) {
        setAutoLogon(item.checked);
      },
    },
    {
      type: 'separator',
    },
    {
      type: 'normal',
      label: locale.close,
      role: 'quit',
      enabled: true,
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', tray.popUpContextMenu);
}

app.on('ready', () => {
  mainTray = new Tray(resolve(__dirname, 'assets', 'iconTemplate.png'));

  render(mainTray);
});
