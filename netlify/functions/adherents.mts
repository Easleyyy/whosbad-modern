import { getStore } from '@netlify/blobs';
import { handleAdherents, type AdherentStore } from '../lib/adherentsApi';

// One JSON blob holds the whole list (a club has a few hundred names at most);
// conditional writes (onlyIfMatch / onlyIfNew) make concurrent adds safe.
const KEY = 'list';

const blobStore = (): AdherentStore => {
  const store = getStore({ name: 'adherents', consistency: 'strong' });
  return {
    async read() {
      const entry = await store.getWithMetadata(KEY, { type: 'json' });
      return { names: Array.isArray(entry?.data) ? (entry.data as string[]) : [], version: entry?.etag };
    },
    async write(names, version) {
      const res = await store.setJSON(KEY, names, version ? { onlyIfMatch: version } : { onlyIfNew: true });
      return res.modified;
    },
  };
};

export default async (req: Request) => handleAdherents(req, blobStore());
