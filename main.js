const { resolve, basename } = require('path');
const {
  app, Menu, Tray, dialog, Notification,
} = require('electron');

const { spawn } = require('child_process');
const fixPath = require('fix-path');
const fs = require('fs');

const Store = require('electron-store');
const Sentry = require('@sentry/electron');

fixPath();

Sentry.init({ dsn: 'https://18c9943a576d41248b195b5678f2724e@sentry.io/1506479' });

const schema = {
  projects: {
    type: 'string',
  },
};

let mainTray = {};

if (app.dock) {
  app.dock.hide();
}

const store = new Store({ schema });

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

function sendError(p) {
  const locale = getLocale();

  p.stderr.on('data', (data) => {
    callNotification(locale.error, data.toString());
  });
}

function render(tray = mainTray) {
  const storedProjects = store.get('projects');
  const projects = storedProjects ? JSON.parse(storedProjects) : [];
  const locale = getLocale();

  const items = projects.map(({ name, path }) => ({
    label: name,
    submenu: [
      {
        label: locale.openCode,
        click: () => {
          const p = spawn('code', [path], { shell: true });
          sendError(p);
        },
      },
      {
        label: locale.openSub,
        click: () => {
          const p = spawn('subl', [path], { shell: true });
          sendError(p);
        },
      },
      {
        label: locale.openPhp,
        click: () => {
          const p = spawn('pstorm', [path], { shell: true });
          sendError(p);
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
