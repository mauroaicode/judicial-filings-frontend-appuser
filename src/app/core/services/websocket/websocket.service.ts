import { inject, Injectable, OnDestroy } from '@angular/core';
import Echo, { type ConnectionStatus } from 'laravel-echo';
import Pusher from 'pusher-js';
import { environment } from '@app/core/config/environment.config';
import { AuthService } from '@app/core/auth/auth.service';

/**
 * Presence channel. Echo adds the `presence-` prefix itself.
 */
const APP_USERS_ONLINE_CHANNEL = 'app-users.online';

type BroadcastAuthData = {
    auth: string;
    channel_data?: string;
    shared_secret?: string;
};

type BroadcastAuthorizerCallback = (error: Error | null, authData: BroadcastAuthData | null) => void;

/**
 * Make Pusher available globally as Laravel Echo expects it.
 */
(window as Window & { Pusher?: typeof Pusher }).Pusher = Pusher;

@Injectable({
    providedIn: 'root',
})
export class WebsocketService implements OnDestroy {
    private _authService = inject(AuthService);
    private _echo: Echo<'reverb'> | null = null;
    private _connectedToken: string | null = null;
    private _intentionalDisconnect = false;
    private _destroyed = false;
    private _unauthorizedExitStarted = false;
    private _connectionGeneration = 0;
    private _reconnectTimer: number | null = null;
    private _unbindConnection: (() => void) | null = null;

    constructor() {
        this._authService.onAccessTokenChange((token) => {
            if (this._destroyed) return;
            if (token) {
                this.connect();
                return;
            }
            this.disconnect();
        });
    }

    ngOnDestroy(): void {
        this._destroyed = true;
        this.disconnect();
    }

    /**
     * Opens Echo with the current token and joins the presence channel.
     * No-ops when there is no token. Reuses the socket when the token did not change.
     */
    public connect(): void {
        const token = this._authService.accessToken;
        if (!token || this._destroyed) return;

        if (this._echo && this._connectedToken === token) {
            this._intentionalDisconnect = false;
            this._ensureConnectionOpen();
            this._joinPresence();
            return;
        }

        this._openConnection(token);
    }

    /**
     * Leaves the presence channel and closes the socket.
     */
    public disconnect(): void {
        this._connectionGeneration += 1;
        this._intentionalDisconnect = true;
        this._clearReconnectTimer();
        this._unbindConnection?.();
        this._unbindConnection = null;

        const echo = this._echo;
        this._echo = null;
        this._connectedToken = null;

        if (!echo) return;

        echo.leave(APP_USERS_ONLINE_CHANNEL);
        echo.disconnect();
    }

    /**
     * Re-initializes Echo with the current auth token.
     */
    public refreshConnection(): void {
        const token = this._authService.accessToken;
        this.disconnect();
        if (token && !this._destroyed) {
            this.connect();
        }
    }

    /**
     * Returns the Echo instance, connecting first when a token exists.
     */
    public get echo(): Echo<'reverb'> {
        if (!this._echo) {
            this.connect();
        }
        if (!this._echo) {
            throw new Error('WebSocket is unavailable without an access token.');
        }
        return this._echo;
    }

    /**
     * Listen to any event on a private channel
     *
     * @param channelName The name of the private channel
     * @param event The event name (suffix with . for literal match if needed)
     * @param callback Function to handle the received data
     */
    public listenPrivate(channelName: string, event: string, callback: (data: unknown) => void): void {
        if (!this._authService.accessToken) return;
        this.connect();
        this._echo?.private(channelName).listen(event, callback);
    }

    /**
     * Join a private channel
     *
     * @param channelName The name of the private channel
     */
    public joinPrivate(channelName: string) {
        if (!this._authService.accessToken) return null;
        this.connect();
        return this._echo?.private(channelName) ?? null;
    }

    /**
     * Leave a channel
     *
     * @param channelName The name of the channel to leave
     */
    public leave(channelName: string): void {
        this._echo?.leave(channelName);
    }

    private _openConnection(token: string): void {
        if (this._echo) {
            this.disconnect();
        }

        this._intentionalDisconnect = false;
        this._connectedToken = token;
        const generation = this._connectionGeneration;

        try {
            this._echo = new Echo<'reverb'>({
                broadcaster: 'reverb',
                key: environment.reverb.appKey,
                wsHost: environment.reverb.host,
                wsPort: Number(environment.reverb.port),
                wssPort: Number(environment.reverb.port),
                forceTLS: environment.reverb.scheme === 'https',
                enabledTransports: ['ws', 'wss'],
                authEndpoint: this._broadcastAuthUrl(),
                auth: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/json',
                    },
                },
                authorizer: (channel: { name: string }) => ({
                    authorize: (socketId: string, callback: BroadcastAuthorizerCallback) => {
                        this._authorizeChannel(channel.name, socketId, generation, callback);
                    },
                }),
            });
        } catch {
            this._echo = null;
            this._connectedToken = null;
            return;
        }

        this._unbindConnection = this._echo.connector.onConnectionChange((status) => {
            if (generation !== this._connectionGeneration || this._intentionalDisconnect) return;
            this._handleConnectionStatus(status);
        });

        this._joinPresence();
    }

    /**
     * Auth lives outside /api. The server resolves IP and member data.
     * The body is only the socket id and the channel name.
     */
    private _authorizeChannel(
        channelName: string,
        socketId: string,
        generation: number,
        callback: BroadcastAuthorizerCallback,
    ): void {
        const token = this._authService.accessToken;
        if (!token || generation !== this._connectionGeneration) {
            callback(new Error('Missing token'), null);
            return;
        }

        fetch(this._broadcastAuthUrl(), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                socket_id: socketId,
                channel_name: channelName,
            }),
        })
            .then(async (response) => {
                if (generation !== this._connectionGeneration || this._intentionalDisconnect) {
                    callback(new Error('Connection closed'), null);
                    return;
                }

                if (response.status === 401) {
                    callback(new Error('Unauthorized'), null);
                    this._exitAfterUnauthorized();
                    return;
                }

                if (!response.ok) {
                    callback(new Error(`Broadcast auth failed (${response.status})`), null);
                    return;
                }

                callback(null, (await response.json()) as BroadcastAuthData);
            })
            .catch((error: unknown) => {
                callback(error instanceof Error ? error : new Error('Broadcast auth failed'), null);
            });
    }

    private _joinPresence(): void {
        if (!this._echo || !this._authService.accessToken || this._intentionalDisconnect) return;
        this._echo.join(APP_USERS_ONLINE_CHANNEL);
    }

    private _handleConnectionStatus(status: ConnectionStatus): void {
        if (!this._authService.accessToken) return;

        if (status === 'connected') {
            this._joinPresence();
            return;
        }

        if (status === 'disconnected' || status === 'failed') {
            this._scheduleReconnect();
        }
    }

    private _ensureConnectionOpen(): void {
        const connection = this._echo?.connector.pusher.connection;
        if (!connection) return;
        if (connection.state === 'disconnected' || connection.state === 'unavailable' || connection.state === 'failed') {
            this._echo?.connector.pusher.connect();
        }
    }

    private _scheduleReconnect(): void {
        if (this._reconnectTimer !== null || this._intentionalDisconnect || this._destroyed) return;

        this._reconnectTimer = window.setTimeout(() => {
            this._reconnectTimer = null;
            if (this._intentionalDisconnect || this._destroyed || !this._authService.accessToken || !this._echo) {
                return;
            }

            const state = this._echo.connector.pusher.connection.state;
            if (state === 'connected') {
                this._joinPresence();
                return;
            }
            if (state !== 'connecting') {
                this._echo.connector.pusher.connect();
            }
        }, 1000);
    }

    private _exitAfterUnauthorized(): void {
        if (this._unauthorizedExitStarted) return;
        this._unauthorizedExitStarted = true;
        this._authService.signOut().subscribe();
        location.reload();
    }

    private _broadcastAuthUrl(): string {
        return `${environment.baseUrl.replace(/\/$/, '')}/broadcasting/auth`;
    }

    private _clearReconnectTimer(): void {
        if (this._reconnectTimer === null) return;
        window.clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
    }
}
