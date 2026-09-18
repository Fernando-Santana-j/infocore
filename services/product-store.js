const fs = require('fs');
const path = require('path');
const { buildPublicCatalog, publicImage } = require('./product-catalog');

const DEFAULT_CACHE_FILE = path.join(__dirname, '..', '.cache', 'products.json');
function createProductStore() {
  const cacheFile = process.env.PRODUCT_CATALOG_CACHE_FILE === 'memory' ? null : path.resolve(process.env.PRODUCT_CATALOG_CACHE_FILE || DEFAULT_CACHE_FILE);
  let snapshot = { available: false, reason: 'catalog_loading', count: 0, inStockCount: 0, categories: [], products: [], updatedAt: '' };
  let running = null;
  let timer = null;
  let started = false;
  let unsubscribe = null;

  try {
    if (!cacheFile) throw new Error('memory_cache');
    const stored = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (stored.available && Array.isArray(stored.products)) {
      snapshot = { ...stored, products: stored.products.map((product) => ({ ...product, image: publicImage(product.image) })) };
    }
  } catch (_) { /* O cache será criado após a primeira leitura válida. */ }

  const getSnapshot = () => ({ ...snapshot, categories: snapshot.categories.map((category) => ({ ...category })), products: snapshot.products.map((product) => ({ ...product })) });

  async function persist(data) {
    if (!cacheFile) return;
    await fs.promises.mkdir(path.dirname(cacheFile), { recursive: true });
    const temporary = `${cacheFile}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(temporary, `${JSON.stringify(data)}\n`, 'utf8');
    await fs.promises.rename(temporary, cacheFile);
  }

  async function refresh() {
    if (running) return running;
    running = (async () => {
      try {
        const models = require('../firebase/models');
        const next = buildPublicCatalog(await models.findAll({ colecao: 'products' }));
        await persist(next);
        snapshot = next;
        process.stdout.write(`[CATÁLOGO] cache atualizado: ${next.count} produtos\n`);
      } catch (error) {
        process.stderr.write(`[CATÁLOGO] atualização adiada: ${String(error?.message || 'erro desconhecido').slice(0, 180)}\n`);
      } finally { running = null; }
      return getSnapshot();
    })();
    return running;
  }

  function start() {
    if (process.env.PRODUCT_CATALOG_SYNC === '0' || started) return;
    started = true;
    const connect = () => {
      try {
        const db = require('../firebase/db');
        unsubscribe = db.collection('products').onSnapshot(async (result) => {
          try {
            const next = buildPublicCatalog(result.docs.map((document) => ({ ...document.data(), id: document.id })));
            await persist(next);
            snapshot = next;
            process.stdout.write(`[CATÁLOGO] atualização em tempo real: ${next.count} produtos\n`);
          } catch (error) {
            process.stderr.write(`[CATÁLOGO] não foi possível gravar a atualização: ${String(error?.message || 'erro desconhecido').slice(0, 180)}\n`);
          }
        }, (error) => {
          process.stderr.write(`[CATÁLOGO] conexão em tempo real adiada: ${String(error?.message || 'erro desconhecido').slice(0, 180)}\n`);
          unsubscribe?.();
          unsubscribe = null;
          timer = setTimeout(connect, 60000);
          timer.unref();
        });
      } catch (error) {
        process.stderr.write(`[CATÁLOGO] conexão em tempo real adiada: ${String(error?.message || 'erro desconhecido').slice(0, 180)}\n`);
        timer = setTimeout(connect, 60000);
        timer.unref();
      }
    };
    timer = setTimeout(() => {
      timer = null;
      connect();
    }, 3000);
      timer.unref();
  }

  return { getSnapshot, refresh, start };
}

module.exports = createProductStore;
