import { AppConfig } from '../types';
export declare function generateOpenApiSpec(config: AppConfig, version?: string): {
    openapi: string;
    info: {
        title: string;
        description: string;
        version: string;
    };
    components: {
        securitySchemes: {
            ApiKeyAuth: {
                type: string;
                in: string;
                name: string;
            };
        } | {
            ApiKeyAuth?: undefined;
        };
    };
    security: {
        ApiKeyAuth: never[];
    }[];
    paths: Record<string, Record<string, unknown>>;
};
//# sourceMappingURL=openapi.d.ts.map