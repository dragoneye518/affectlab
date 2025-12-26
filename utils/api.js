let _shownAffectLabNetToast = false;

const _nowTs = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const _sanitizeApiBase = (raw) => {
    if (typeof raw !== 'string') return '';
    let s = raw.trim();
    s = s.replace(/`/g, '').trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    s = s.replace(/\s+/g, '');
    if (!/^https?:\/\//i.test(s)) return '';
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
};

const _getPlatform = () => {
    try {
        if (typeof wx.getDeviceInfo === 'function') {
            const di = wx.getDeviceInfo();
            return di && di.platform ? di.platform : '';
        }
    } catch (e) {}
    try {
        if (typeof wx.getAppBaseInfo === 'function') {
            const abi = wx.getAppBaseInfo();
            if (abi && typeof abi.platform === 'string' && abi.platform) return abi.platform;
            const host = abi && typeof abi.host === 'object' ? abi.host : null;
            if (host && typeof host.platform === 'string' && host.platform) return host.platform;
        }
    } catch (e) {}
    return '';
};

const getAffectLabApiBase = () => {
    const rawStored = wx.getStorageSync('affectlab_api_base');
    const stored = _sanitizeApiBase(rawStored);
    if (stored) {
        try {
            if (typeof rawStored === 'string' && rawStored !== stored) {
                wx.setStorageSync('affectlab_api_base', stored);
            }
        } catch (e) {}
        return stored;
    }
    const platform = _getPlatform();
    if (platform === 'devtools') return 'http://127.0.0.1:12017/affectlab/api';
    return 'http://192.168.3.6:12017/affectlab/api';
};

export const getAffectLabToken = () => {
    return wx.getStorageSync('affectlab_token') || '';
};

export const setAffectLabToken = (token) => {
    wx.setStorageSync('affectlab_token', token || '');
};

export const requestAffectLab = ({ path, method = 'GET', data, auth = true, timeoutMs }) => {
    return new Promise((resolve, reject) => {
        const token = getAffectLabToken();
        const headers = { "Content-Type": "application/json" };
        if (auth && token) headers["Authorization"] = `Bearer ${token}`;

        const debug = !!wx.getStorageSync('affectlab_api_debug');
        const storedBase = _sanitizeApiBase(wx.getStorageSync('affectlab_api_base'));
        const base = getAffectLabApiBase();
        const platform = _getPlatform();

        const timeout = (typeof timeoutMs === 'number' && timeoutMs > 0) ? Math.floor(timeoutMs) : 8000;

        const restPath = path.startsWith('/') ? path : `/${path}`;
        const candidateBases = [];
        const pushBase = (b) => {
            if (b && typeof b === 'string' && candidateBases.indexOf(b) < 0) candidateBases.push(b);
        };
        pushBase(base);
        if (!storedBase && platform === 'devtools') {
            pushBase('http://127.0.0.1:12017/affectlab/api');
            pushBase('http://localhost:12017/affectlab/api');
            pushBase('http://192.168.3.6:12017/affectlab/api');
        }

        const doRequest = (baseUrl, tryIdx) => {
            const url = `${baseUrl}${restPath}`;
            const startedAt = Date.now();
            try {
                const payload = debug ? { url, method, data: data || null, tryIdx } : { url, method, tryIdx };
                console.log(`[${_nowTs()}] AffectLab request`, payload);
            } catch (e) {}
            wx.request({
                url,
                method,
                header: headers,
                data,
                timeout,
                success: (res) => {
                    try {
                        const ms = Date.now() - startedAt;
                        if (debug) console.log(`[${_nowTs()}] AffectLab response`, { url, statusCode: res && res.statusCode, ms, data: res && res.data });
                        else console.log(`[${_nowTs()}] AffectLab response`, { url, statusCode: res && res.statusCode, ms });
                    } catch (e) {}
                    resolve(res);
                },
                fail: (err) => {
                    const errMsg = err && err.errMsg ? String(err.errMsg) : '';
                    try {
                        const ms = Date.now() - startedAt;
                        console.error(`[${_nowTs()}] AffectLab request failed`, { url, method, ms, errMsg });
                    } catch (e) {}

                    const canRetry = !storedBase && platform === 'devtools' && (tryIdx + 1) < candidateBases.length;
                    if (canRetry) {
                        doRequest(candidateBases[tryIdx + 1], tryIdx + 1);
                        return;
                    }

                    if (!_shownAffectLabNetToast) {
                        _shownAffectLabNetToast = true;
                        let tip = '请求失败';
                        const lower = errMsg.toLowerCase();
                        if (lower.includes('url not in domain list')) tip = '未配置合法域名';
                        else if (lower.includes('ssl') || lower.includes('tls')) tip = 'HTTPS/TLS 配置问题';
                        else if (lower.includes('econnrefused') || lower.includes('connection refused')) tip = '连接被拒绝：后端未启动或地址不通';
                        else if (lower.includes('timeout')) tip = '请求超时：网络或后端不可达';
                        try {
                            wx.showToast({ title: `后端请求失败：${tip}`, icon: 'none' });
                        } catch (e) {}
                    }
                    reject(err);
                }
            });
        };

        doRequest(candidateBases[0], 0);
    });
};

export const affectLabLogin = (userInfo) => {
    return new Promise((resolve) => {
        wx.login({
            success: async (loginRes) => {
                const code = loginRes.code;
                if (!code) {
                    resolve(null);
                    return;
                }
                try {
                    const res = await requestAffectLab({
                        path: '/user/login',
                        method: 'POST',
                        data: { code, userInfo: userInfo || null },
                        auth: false
                    });
                    if (res.statusCode === 200 && res.data && res.data.data && res.data.data.token) {
                        setAffectLabToken(res.data.data.token);
                        resolve(res.data.data);
                        return;
                    }
                    resolve(null);
                } catch (e) {
                    resolve(null);
                }
            },
            fail: () => resolve(null)
        });
    });
};

export const polishTextWithDeepSeek = (inputText) => {
    return new Promise(async (resolve) => {
        const input = (inputText || '').trim();
        if (!input) {
            resolve(null);
            return;
        }

        try {
            const res = await requestAffectLab({
                path: '/text/polish',
                method: 'POST',
                data: { inputText: input },
                auth: false
            });
            if (res && res.statusCode === 200 && res.data && Array.isArray(res.data.options)) {
                resolve(res.data);
                return;
            }
            resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
};

let _templateCache = null;
let _templateCacheAt = 0;

const normalizeTemplate = (raw) => {
    const assets = raw && typeof raw.assets === 'object' && raw.assets ? raw.assets : {};
    const imageUrl = assets.SR || assets.R || assets.N || assets.SSR || '';
    return {
        id: raw.template_id,
        title: raw.title || raw.template_id,
        subtitle: raw.subtitle || '',
        tag: raw.tag || '',
        assets,
        imageUrl,
        cost: Number(raw.cost || 1),
        category: raw.category || '',
        inputHint: raw.input_hint || '',
        quickPrompts: Array.isArray(raw.quick_prompts) ? raw.quick_prompts : [],
        description: raw.description || '',
        keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
        presetTexts: Array.isArray(raw.preset_texts) ? raw.preset_texts : []
    };
};

export const fetchAffectLabTemplates = async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && _templateCache && (now - _templateCacheAt) < 5 * 60 * 1000) {
        return _templateCache;
    }

    try {
        const res = await requestAffectLab({ path: '/templates?limit=200&offset=0', method: 'GET', auth: false });
        const items = res?.data?.data?.items;
        if (res?.statusCode === 200 && Array.isArray(items)) {
            const next = items
                .filter((it) => it && it.template_id)
                .map(normalizeTemplate);
            _templateCache = next;
            _templateCacheAt = now;
            return _templateCache;
        }
        if (wx.getStorageSync('affectlab_api_debug')) {
            try {
                console.error('AffectLab templates unexpected response:', { statusCode: res && res.statusCode, data: res && res.data });
            } catch (e) {}
        }
        _templateCache = [];
        _templateCacheAt = now;
        return _templateCache;
    } catch (e) {
        if (wx.getStorageSync('affectlab_api_debug')) {
            try {
                console.error('AffectLab templates request error:', e);
            } catch (err) {}
        }
        _templateCache = [];
        _templateCacheAt = now;
        return _templateCache;
    }
};
