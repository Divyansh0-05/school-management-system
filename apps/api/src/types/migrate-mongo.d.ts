/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'migrate-mongo' {
  export const database: {
    connect: () => Promise<{ db: any; client: any }>;
  };
  export const up: (db: any, client: any) => Promise<string[]>;
  export const down: (db: any, client: any) => Promise<string[]>;
  export const status: (db: any) => Promise<any[]>;
}
