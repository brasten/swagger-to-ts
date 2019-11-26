import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'js-yaml';
import * as prettier from 'prettier';
import swaggerToTSRunner from '../src';
import { Swagger3, warningMessage } from '../src/swagger-3';
import { Swagger2Options } from '../src/swagger-2';

const swaggerToTS =
  (swagger: Swagger3, opts?: Swagger2Options) =>
    swaggerToTSRunner(swagger, { ...opts, swagger: 3 });

/* eslint-disable @typescript-eslint/explicit-function-return-type */

// Let Prettier handle formatting, not the test expectations
function format(
  spec: string,
  wrapper: string = 'declare namespace OpenAPI3',
  injectWarning: boolean = false
): string {
  return prettier.format(
    `
    ${injectWarning ? `${warningMessage} \n` : ''}
    ${wrapper} {
      ${spec}
    }
    `,
    {
      parser: 'typescript',
      singleQuote: true,
    }
  );
}

describe('Swagger 3 spec', () => {
  describe('core Swagger types', () => {
    it('string -> string', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                email: { type: 'string' },
              },
              type: 'object',
            },
          }
        },
      };

      const ts = format(`
      export interface User {
        email?: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('integer -> number', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                age: { type: 'integer' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        age?: number;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('number -> number', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                lat: { type: 'number', format: 'float' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        lat?: number;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('boolean -> boolean', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                active: { type: 'boolean' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        active?: boolean;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });
  });

  describe('complex structures', () => {
    it('handles arrays of primitive structures', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                teams: { type: 'array', items: { type: 'string' } },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        teams?: string[];
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('handles arrays of references', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            Team: {
              properties: {
                id: { type: 'string' },
              },
              type: 'object',
            },
            User: {
              properties: {
                teams: { type: 'array', items: { $ref: '#/components/schemas/Team' } },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        teams?: Team[];
      }
      export interface Team {
        id?: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('handles nested objects', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                remote_id: {
                  type: 'object',
                  properties: { id: { type: 'string' } },
                },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        remote_id?: UserRemoteId;
      }
      export interface UserRemoteId {
        id?: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('handles arrays of nested objects', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                remote_ids: {
                  type: 'array',
                  items: { type: 'object', properties: { id: { type: 'string' } } },
                },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        remote_ids?: UserRemoteIds[];
      }
      export interface UserRemoteIds {
        id?: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('handles arrays of arrays of arrays', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            Resource: {
              properties: {
                environments: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface Resource {
        environments?: string[][][];
      }
      `);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('handles allOf', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            Admin: {
              allOf: [
                { $ref: '#/components/schemas/User' },
                {
                  properties: {
                    rbac: { type: 'string' },
                  },
                  type: 'object',
                },
              ],
              type: 'object',
            },
            User: {
              properties: {
                email: { type: 'string' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        email?: string;
      }
      export interface Admin extends User {
        rbac?: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('handles oneOf', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            Record: {
              properties: {
                rand: {
                  oneOf: [{ type: 'string' }, { type: 'number' }],
                  type: 'array',
                },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface Record {
        rand?: string | number;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('handles enum', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                role: { type: 'string', enum: ['user', 'admin'] },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        role?: 'user' | 'admin';
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });
  });

  describe('property names', () => {
    it('preserves snake_case keys by default', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                profile_image: { type: 'string' },
                address_line_1: { type: 'string' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        profile_image?: string;
        address_line_1?: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('converts snake_case to camelCase if specified', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                profile_image: { type: 'string' },
                address_line_1: { type: 'string' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        profileImage?: string;
        addressLine1?: string;
      }`);

      expect(swaggerToTS(swagger, { camelcase: true })).toBe(ts);
    });

    it('handles kebab-case property names', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                'profile-image': { type: 'string' },
                'address-line-1': { type: 'string' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        'profile-image'?: string;
        'address-line-1'?: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });
  });

  describe('TS features', () => {
    it('specifies required types', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                username: { type: 'string' },
              },
              required: ['username'],
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        username: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('flattens single-type $refs', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            User: {
              properties: {
                password: { $ref: '#/components/schemas/UserPassword' },
              },
              type: 'object',
            },
            UserPassword: {
              type: 'string',
            },
          },
        },
      };

      const ts = format(`
      export interface User {
        password?: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });
  });

  it('can deal with additionalProperties: true', () => {
    const swagger: Swagger3 = {
      components: {
        schemas: {
          FeatureMap: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    };

    const ts = format(`
    export interface FeatureMap {
      [name: string]: any;
    }`);

    expect(swaggerToTS(swagger)).toBe(ts);
  });

  it('can deal with additionalProperties of type', () => {
    const swagger: Swagger3 = {
      components: {
        schemas: {
          Credentials: {
            type: 'object',
            additionalProperties: {
              type: 'string',
            },
          },
        },
      },
    };

    const ts = format(`
    export interface Credentials {
      [name: string]: string;
    }`);

    expect(swaggerToTS(swagger)).toBe(ts);
  });

  describe('other output', () => {
    it('skips top-level array definitions', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            Colors: {
              type: 'array',
              items: { $ref: '#/components/schemas/Color' },
            },
            Color: { type: 'string' },
          },
        },
      };

      const ts = format('');

      expect(swaggerToTS(swagger)).toBe(ts);
    });
  });

  describe('wrapper option', () => {
    it('has a default wrapper', () => {
      const swagger: Swagger3 = {
        components: {
          schemas: {
            Name: {
              properties: {
                first: { type: 'string' },
                last: { type: 'string' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(`
      export interface Name {
        first?: string;
        last?: string;
      }`);

      expect(swaggerToTS(swagger)).toBe(ts);
    });

    it('allows namespace wrappers', () => {
      const wrapper = 'export namespace MyNamespace';

      const swagger: Swagger3 = {
        components: {
          schemas: {
            Name: {
              properties: {
                first: { type: 'string' },
                last: { type: 'string' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(
        `
      export interface Name {
        first?: string;
        last?: string;
      }`,
        wrapper
      );

      expect(swaggerToTS(swagger, { wrapper })).toBe(ts);
    });

    it('allows module wrappers', () => {
      const wrapper = 'declare module MyNamespace';

      const swagger: Swagger3 = {
        components: {
          schemas: {
            Name: {
              properties: {
                first: { type: 'string' },
                last: { type: 'string' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(
        `
      export interface Name {
        first?: string;
        last?: string;
      }`,
        wrapper
      );

      expect(swaggerToTS(swagger, { wrapper })).toBe(ts);
    });
  });

  describe('file warning option', () => {
    it('injects a warning message at the top of the file', () => {
      const wrapper = 'declare module WarningMessageNamespace';

      const swagger: Swagger3 = {
        components: {
          schemas: {
            Name: {
              properties: {
                first: { type: 'string' },
                last: { type: 'string' },
              },
              type: 'object',
            },
          },
        },
      };

      const ts = format(
        `
      export interface Name {
        first?: string;
        last?: string;
      }
      `,
        wrapper,
        true
      );

      expect(swaggerToTS(swagger, { wrapper, injectWarning: true })).toBe(ts);
    });
  });

  describe('snapshots', () => {
    // Basic snapshot test.
    // If changes are all good, run `npm run generate` to update (⚠️ This will cement your changes so be sure they’re 100% correct!)
    it('generates the example output correctly', () => {
      const input = yaml.safeLoad(
        readFileSync(resolve(__dirname, '..', 'example', 'input-3.yaml'), 'UTF-8')
      );
      const output = readFileSync(resolve(__dirname, '..', 'example', 'output-3.d.ts'), 'UTF-8');

      expect(swaggerToTS(input)).toBe(output);
    });

    it('generates the example output without wrappers', () => {
      const input = yaml.safeLoad(
        readFileSync(resolve(__dirname, '..', 'example', 'input-3.yaml'), 'UTF-8')
      );
      const nowrapper = readFileSync(resolve(__dirname, '..', 'example', 'nowrapper.ts'), 'UTF-8');

      expect(swaggerToTS(input, { wrapper: false })).toBe(nowrapper);
    });
  });
});
