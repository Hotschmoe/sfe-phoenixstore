export type ResponseData = {
    status: 'success' | 'error';
    data?: any;
    message?: string;
    timestamp: string;
};

export type WebSocketMessage = {
    type: string;
    requestId: string;
    data?: any;
    message?: string;
    timestamp: string;
};

export type AuthTokens = {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}; 