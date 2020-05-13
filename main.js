const { resolve, basename } = require('path');
const {
  app, Menu, Tray, dialog, Notification, nativeImage,
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

if (app.dock) {
  app.dock.hide();
}

app.setName('CodeTray');

const store = new Store({ schema });

const appName = app.getName();
const appPath = app.getAppPath();

const autoLauncher = new AutoLaunch({ name: 'CodeTray', path: `${appPath}/${appName}`, isHidden: true });

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

function callNotification(title, body) {
  const iconAddress = resolve(__dirname, 'assets', 'iconTemplate.png');
  const notif = { title, body, icon: iconAddress };
  new Notification(notif).show();
}

function numberFormat(number, decimals, decPoint, thousandsPoint) {
  const locale = getLocale();

  // eslint-disable-next-line no-restricted-globals
  if (number == null || !isFinite(number)) {
    callNotification(locale.error, 'number is not valid');
  }

  if (!decimals) {
    const len = number.toString().split('.').length;
    // eslint-disable-next-line no-param-reassign
    decimals = len > 1 ? len : 0;
  }

  if (!decPoint) {
    // eslint-disable-next-line no-param-reassign
    decPoint = '.';
  }

  if (!thousandsPoint) {
    // eslint-disable-next-line no-param-reassign
    thousandsPoint = ',';
  }

  // eslint-disable-next-line no-param-reassign
  number = parseFloat(number).toFixed(decimals);

  // eslint-disable-next-line no-param-reassign
  number = number.replace('.', decPoint);

  const splitNum = number.split(decPoint);
  splitNum[0] = splitNum[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsPoint);
  // eslint-disable-next-line no-param-reassign
  number = splitNum.join(decPoint);

  return number;
}

function getMoeda(code) {
  axios.get(`https://economia.awesomeapi.com.br/${code}`)
    .then((res) => {
      const dif = ((res.data[0].varBid >= 0) ? 'Alta' : 'Queda').concat(` de ${res.data[0].varBid}%`);
      const price = numberFormat(res.data[0].bid);
      callNotification(`Valor do ${res.data[0].name}`, `R$ ${price} \n${dif}`);
    });
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
        icon: nativeImage.createFromPath(resolve(__dirname, 'assets', 'iconVscode.png')).resize({ width: 16 }),
        click: () => {
          const p = spawn('code', [path], { shell: true });
          sendError(p);
        },
      },
      {
        label: locale.openSub,
        icon: nativeImage.createFromPath(resolve(__dirname, 'assets', 'iconSublime.png')).resize({ width: 16 }),
        click: () => {
          const p = spawn('subl', [path], { shell: true });
          sendError(p);
        },
      },
      {
        label: locale.openPhp,
        icon: nativeImage.createFromPath(resolve(__dirname, 'assets', 'iconPhpStorm.png')).resize({ width: 16 }),
        click: () => {
          const p = spawn('pstorm', [path], { shell: true });
          sendError(p);
        },
      },
      {
        type: 'separator',
      },
      {
        // Mac only por enquanto
        label: 'Abrir no Terminal',
        icon: nativeImage.createFromPath(resolve(__dirname, 'assets', 'iconITerm.png')).resize({ width: 16 }),
        click() {
          if (process.platform === 'darwin') {
            spawn('open', ['-a', 'iTerm', [path]], { stdio: 'inherit' });
          }
        },
      },
      {
        type: 'separator',
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

  const saveProject = (pathed) => {
    const [path] = pathed;
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

    callNotification(`Projeto ${name}`, 'Adicionado com sucesso!!');

    render();
  };

  const contextMenu = Menu.buildFromTemplate([
    {
      label: locale.add,
      click: () => {
        const result = dialog.showOpenDialog({ properties: ['openDirectory'] });

        if (!result) return;

        saveProject(result);
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
      label: 'Moedas',
      enabled: true,
      submenu: [
        {
          label: 'Dolar',
          click() {
            getMoeda('usd');
          },
        },
        {
          label: 'BTC',
          click() {
            getMoeda('btc');
          },
        },
      ],
    },
    {
      type: 'separator',
    },
    {
      label: 'Iniciar no Login',
      type: 'checkbox',
      checked: initLogin,
      enabled: true,
      visible: true,
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

  tray.setToolTip(`${items.length} ${locale.count}`);

  tray.on('click', tray.popUpContextMenu);

  tray.on('drop-files', (event, files) => {
    saveProject(files);
  });
}

app.on('ready', () => {
  mainTray = new Tray(resolve(__dirname, 'assets', 'iconTemplate.png'));

  render(mainTray);
});
