import fs from 'fs';

export interface TlsOptions {
    serverKey?: string;
    serverCert?: string;
    ca?: string;
}

export interface TlsServerOptions {
    key: Buffer;
    cert: Buffer;
    ca?: Buffer;
}

/*
 * Build the { key, cert, ca } object for tls.createServer / https.createServer from a pool's
 * tlsOptions. Returns null when TLS cannot be served — the key/cert path is unset, or the file
 * is missing/unreadable (e.g. Let's Encrypt's root-only archive). Callers MUST treat null as
 * "refuse to open this port" rather than downgrading to plaintext, since a port declared
 * tls:true that silently served cleartext would leak the credentials clients send expecting an
 * encrypted channel.
 */
export function buildTlsServerOptions(tlsOpts: TlsOptions | undefined): TlsServerOptions | null {
    if (!tlsOpts || !tlsOpts.serverKey || !tlsOpts.serverCert) return null;
    try {
        return {
            key: fs.readFileSync(tlsOpts.serverKey),
            cert: fs.readFileSync(tlsOpts.serverCert),
            ca: tlsOpts.ca ? fs.readFileSync(tlsOpts.ca) : undefined,
        };
    } catch {
        return null;
    }
}
