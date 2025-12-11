export interface Tenant {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Project {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface ApiKey {
    id: string;
    projectId: string;
    name: string;
    keyHash: string;
    lastUsedAt?: Date;
    createdAt: Date;
    revokedAt?: Date;
}
export interface ApiKeyValidation {
    valid: boolean;
    tenantId?: string;
    projectId?: string;
}
//# sourceMappingURL=index.d.ts.map