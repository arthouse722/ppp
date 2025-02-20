/** @decorator */

import ppp from '../../ppp.js';
import {
  css,
  html,
  Observable,
  when,
  repeat,
  observable
} from '../../vendor/fast-element.min.js';
import { Page, pageStyles } from '../page.js';
import { formatDate } from '../../lib/intl.js';
import { SERVICES, VERSIONING_STATUS } from '../../lib/const.js';
import { parsePPPScript } from '../../lib/ppp-script.js';
import { serviceStateAppearance } from './service.js';
import { later } from '../../lib/ppp-decorators.js';
import '../badge.js';
import '../button.js';
import '../table.js';

await ppp.i18n(import.meta.url);

export const servicesPageTemplate = html`
  <template class="${(x) => x.generateClasses()}">
    <ppp-loader></ppp-loader>
    <form novalidate>
      <div class="page-level control-stack">
        <ppp-page-header>
          Список сервисов
          <ppp-button
            appearance="primary"
            slot="controls"
            @click="${() =>
              ppp.app.navigate({
                page: 'service'
              })}"
          >
            Установить сервис
          </ppp-button>
        </ppp-page-header>
        <div class="table-with-selector">
          <div class="selector-holder">
            <ppp-side-nav
              expanded
              static
              inline
              @click="${(x, c) => x.handleServiceTypeSelectorClick(c)}"
            >
              <ppp-side-nav-group>
                <span slot="title">Или</span>
                <ppp-side-nav-item slug="" ?active="${(x) => !x.activeItem}">
                  <span>Все сервисы</span>
                </ppp-side-nav-item>
              </ppp-side-nav-group>
              <ppp-side-nav-group>
                <span slot="title">Или по типу</span>
                ${repeat(
                  (x) => Object.keys(SERVICES),
                  html`
                    <ppp-side-nav-item
                      slug="${(x) => SERVICES[x]}"
                      ?active="${(x, c) => c.parent.activeItem === SERVICES[x]}"
                    >
                      <span
                        >${(x) => ppp.t(`$const.service.${SERVICES[x]}`)}</span
                      >
                    </ppp-side-nav-item>
                  `
                )}
              </ppp-side-nav-group>
            </ppp-side-nav>
          </div>
          <div class="table-holder">
            <ppp-table
              sticky
              @update="${async (x, c) => {
                const datum = c.event.detail.datum;
                const page = await ppp.app.mountPage(`service-${datum.type}`, {
                  documentId: datum._id,
                  stayHidden: true
                });

                await page.readDocument();

                try {
                  x.beginOperation();
                  await later(1000);
                  await page.updateService();

                  const index = x.documents.findIndex(
                    (d) => d._id === datum._id
                  );

                  if (index > -1) {
                    x.documents[index].version = datum.actualVersion;
                    x.documents[index].versioningStatus = VERSIONING_STATUS.OK;
                    x.documents[index].updatedAt = new Date();
                  }

                  Observable.notify(x, 'documents');
                } finally {
                  x.endOperation();

                  page.remove();
                }
              }}"
              @cleanup="${(x, c) =>
                x.cleanupFromListing({
                  pageName: `service-${c.event.detail.datum.type}`,
                  documentId: c.event.detail.datum._id
                })}"
              :columns="${() => [
                {
                  label: 'Название'
                },
                {
                  label: 'Тип'
                },
                {
                  label: 'Дата создания'
                },
                {
                  label: 'Последнее изменение'
                },
                {
                  label: 'Версия'
                },
                {
                  label: 'Последняя версия'
                },
                {
                  label: 'Состояние'
                },
                {
                  label: 'Действия'
                }
              ]}"
              :rows="${(x) =>
                x.documents.map((datum) => {
                  return {
                    datum,
                    cells: [
                      html`<a
                        class="link"
                        @click="${() => {
                          ppp.app.navigate({
                            page: `service-${datum.type}`,
                            document: datum._id
                          });

                          return false;
                        }}"
                        href="?page=service-${datum.type}&document=${datum._id}"
                      >
                        ${datum.name}
                      </a>`,
                      ppp.t(`$const.service.${datum.type}`),
                      formatDate(datum.createdAt),
                      formatDate(datum.updatedAt ?? datum.createdAt),
                      html`
                        <ppp-badge
                          appearance="${() => {
                            const vs = datum.versioningStatus;

                            if (vs === VERSIONING_STATUS.OK) return 'green';
                            else if (vs === VERSIONING_STATUS.OLD) {
                              return 'yellow';
                            } else if (vs === VERSIONING_STATUS.OFF) {
                              return 'blue';
                            }
                          }}"
                        >
                          ${() => datum.version}
                        </ppp-badge>
                      `,
                      html`
                        <ppp-badge
                          appearance="${() => {
                            const vs = datum.versioningStatus;

                            if (vs === VERSIONING_STATUS.OFF) {
                              return 'blue';
                            } else return 'green';
                          }}"
                        >
                          ${() => datum.actualVersion}
                        </ppp-badge>
                      `,
                      html`
                        <ppp-badge
                          appearance="${serviceStateAppearance(datum)}"
                        >
                          ${ppp.t(
                            `$const.serviceState.${datum.state ?? 'N/A'}`
                          )}
                        </ppp-badge>
                      `,
                      html`
                        <div class="control-line">
                          ${when(
                            () =>
                              datum.versioningStatus === VERSIONING_STATUS.OLD,
                            html`
                              <ppp-button
                                action="update"
                                :datum="${() => datum}"
                                class="xsmall"
                              >
                                Обновить
                              </ppp-button>
                            `
                          )}
                          <ppp-button
                            action="cleanup"
                            :datum="${() => datum}"
                            class="xsmall"
                          >
                            Удалить
                          </ppp-button>
                        </div>
                      `
                    ]
                  };
                })}"
            >
            </ppp-table>
          </div>
        </div>
      </div>
    </form>
  </template>
`;

export const servicesPageStyles = css`
  ${pageStyles}
`;

export class ServicesPage extends Page {
  collection = 'services';

  @observable
  activeItem;

  async activeItemChanged(oldValue, newValue) {
    ppp.app.setURLSearchParams({
      type: this.activeItem || ''
    });

    if (typeof oldValue !== 'undefined') await this.populateDocuments();
  }

  handleServiceTypeSelectorClick({ event }) {
    const item = event
      .composedPath()
      .find((n) => n.tagName?.toLowerCase?.() === 'ppp-side-nav-item');

    if (item) {
      this.activeItem = item.getAttribute('slug') || '';
    }
  }

  async connectedCallback() {
    this.activeItem = ppp.app.params()?.type || '';

    return super.connectedCallback();
  }

  async populate() {
    return (context) => {
      return context.services
        .get('mongodb-atlas')
        .db('ppp')
        .collection('[%#this.collection%]')
        .find({
          removed: { $ne: true },
          type: '[%#this.activeItem%]' || { $exists: true }
        })
        .sort({ updatedAt: -1 });
    };
  }

  async transformMany() {
    return Promise.all(
      this.documents.map((doc) => {
        if (
          doc.type !== SERVICES.PPP_ASPIRANT_WORKER &&
          doc.type !== SERVICES.CLOUDFLARE_WORKER &&
          doc.type !== SERVICES.SUPABASE_PARSER
        ) {
          doc.versioningStatus = VERSIONING_STATUS.OK;
          doc.actualVersion = 1;

          return doc;
        }

        if (!doc.useVersioning || !doc.versioningUrl) {
          doc.versioningStatus = VERSIONING_STATUS.OFF;
          doc.actualVersion = 'N/A';

          return doc;
        }

        return (async () => {
          let url;

          if (doc.versioningUrl.startsWith('/')) {
            const rootUrl = window.location.origin;

            if (rootUrl.endsWith('.github.io'))
              url = new URL('/ppp' + doc.versioningUrl, rootUrl);
            else url = new URL(doc.versioningUrl, rootUrl);
          } else {
            url = new URL(doc.versioningUrl);
          }

          const contentsResponse = await fetch(url.toString(), {
            cache: 'reload'
          });

          const parsed = parsePPPScript(await contentsResponse.text());

          if (parsed && Array.isArray(parsed.meta?.version)) {
            const [version] = parsed.meta?.version;

            doc.actualVersion = Math.abs(+version) || 1;
            doc.versioningStatus =
              doc.version < doc.actualVersion
                ? VERSIONING_STATUS.OLD
                : VERSIONING_STATUS.OK;
          } else {
            doc.versioningStatus = VERSIONING_STATUS.OK;
            doc.actualVersion = 'N/A';
          }

          return doc;
        })();
      })
    );
  }
}

export default ServicesPage.compose({
  template: servicesPageTemplate,
  styles: servicesPageStyles
}).define();
