import * as prettier from 'prettier';
import { Swagger2Options } from 'swagger-2';

export interface Swagger3Schema {
  $ref?: string;
  allOf?: Swagger3Schema[];
  description?: string;
  enum?: string[];
  format?: string;
  items?: Swagger3Schema;
  oneOf?: Swagger3Schema[];
  properties?: { [index: string]: Swagger3Schema };
  nullable?: boolean;
  additionalProperties?: boolean | Swagger3Schema;
  required?: string[];
  type?: 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string';
}

export interface Swagger3 {
  components: {
    schemas: {
      [index: string]: Swagger3Schema;
    },
  };
}


export const warningMessage = `
/**
 * This file was auto-generated by swagger-to-ts.
 * Do not make direct changes to the file.
 */
`;

// Primitives only!
const TYPES: { [index: string]: string } = {
  string: 'string',
  integer: 'number',
  number: 'number',
};

function capitalize(str: string): string {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function camelCase(name: string): string {
  return name.replace(/(-|_|\.|\s)+\w/g, (letter): string =>
    letter.toUpperCase().replace(/[^0-9a-z]/gi, '')
  );
}

function sanitize(name: string): string {
  return name.includes('-') ? `'${name}'` : name;
}

function parse(spec: Swagger3, options: Swagger2Options = {}): string {
  const shouldUseWrapper = options.wrapper !== false;
  const wrapper =
    typeof options.wrapper === 'string' && options.wrapper
      ? options.wrapper
      : 'declare namespace OpenAPI3';
  const shouldCamelCase = options.camelcase || false;
  const shouldInsertWarning = options.injectWarning || false;

  const queue: [string, Swagger3Schema][] = [];

  const output: string[] = [];

  if (shouldInsertWarning) {
    output.push(warningMessage);
  }

  if (wrapper && shouldUseWrapper) {
    output.push(`${wrapper} {`);
  }

  const { components } = spec;

  function getRef(lookup: string): [string, Swagger3Schema] {
    const ID = lookup.replace('#/components/schemas/', '');
    const ref = components.schemas[ID];

    if (!ref) {
      throw new Error(`Could not find reference '${ID}'`);
    }

    return [ID, ref];
  }

  // Returns primitive type, or 'object' or 'any'
  function getType(definition: Swagger3Schema, nestedName: string): string {
    const { $ref, items, type, ...value } = definition;

    const nextInterface = camelCase(nestedName); // if this becomes an interface, it’ll need to be camelCased

    const DEFAULT_TYPE = 'any';

    if ($ref) {
      const [refName, refProperties] = getRef($ref);

      // If a shallow array interface, return that instead
      if (refProperties.items && refProperties.items.$ref) {
        return getType(refProperties, refName);
      }
      if (refProperties.type && TYPES[refProperties.type]) {
        return TYPES[refProperties.type];
      }
      return refName || DEFAULT_TYPE;
    }

    if (items && items.$ref) {
      const [refName] = getRef(items.$ref);
      return `${getType(items, refName)}[]`;
    }

    if (items && items.type) {
      // if an array, keep nesting
      if (items.type === 'array') {
        return `${getType(items, nestedName)}[]`;
      }
      // else if primitive, return type
      if (TYPES[items.type]) {
        return `${TYPES[items.type]}[]`;
      }
      // otherwise if this is an array of nested types, return that interface for later
      queue.push([nextInterface, items]);
      return `${nextInterface}[]`;
    }

    if (Array.isArray(value.oneOf)) {
      return value.oneOf.map((def): string => getType(def, '')).join(' | ');
    }

    if (value.properties) {
      // If this is a nested object, let’s add it to the stack for later
      queue.push([nextInterface, { $ref, items, type, ...value }]);
      return nextInterface;
    }

    if (type) {
      return TYPES[type] || type || DEFAULT_TYPE;
    }

    return DEFAULT_TYPE;
  }

  function buildNextInterface(): void {
    const nextObject = queue.pop();
    if (!nextObject) return; // Geez TypeScript it’s going to be OK
    const [ID, { allOf, properties, required, additionalProperties, type }] = nextObject;

    let allProperties = properties || {};
    const includes: string[] = [];

    // Include allOf, if specified
    if (Array.isArray(allOf)) {
      allOf.forEach((item): void => {
        // Add “implements“ if this references other items
        if (item.$ref) {
          const [refName] = getRef(item.$ref);
          includes.push(refName);
        } else if (item.properties) {
          allProperties = { ...allProperties, ...item.properties };
        }
      });
    }

    // If nothing’s here, let’s skip this one.
    if (
      !Object.keys(allProperties).length &&
      additionalProperties !== true &&
      type &&
      TYPES[type]
    ) {
      return;
    }
    // Open interface
    const isExtending = includes.length ? ` extends ${includes.join(', ')}` : '';

    output.push(`export interface ${shouldCamelCase ? camelCase(ID) : ID}${isExtending} {`);

    // Populate interface
    Object.entries(allProperties).forEach(([key, value]): void => {
      const optional = !Array.isArray(required) || required.indexOf(key) === -1;
      const formattedKey = shouldCamelCase ? camelCase(key) : key;
      const name = `${sanitize(formattedKey)}${optional ? '?' : ''}`;
      const newID = `${ID}${capitalize(formattedKey)}`;
      const interfaceType = getType(value, newID);
      const nullableType = value.nullable == true ? ' | null' : '';

      if (typeof value.description === 'string') {
        // Print out descriptions as jsdoc comments, but only if there’s something there (.*)
        output.push(`/**\n* ${value.description.replace(/\n$/, '').replace(/\n/g, '\n* ')}\n*/`);
      }

      // Handle enums in the same definition
      if (Array.isArray(value.enum)) {
        output.push(`${name}: ${value.enum.map(option => JSON.stringify(option)).join(' | ')};`);
        return;
      }

      output.push(`${name}: ${interfaceType}${nullableType};`);
    });

    if (additionalProperties) {
      if ((additionalProperties as boolean) === true) {
        output.push('[name: string]: any');
      }

      if ((additionalProperties as Swagger3Schema).type) {
        const interfaceType = getType(additionalProperties as Swagger3Schema, '');
        output.push(`[name: string]: ${interfaceType}`);
      }
    }

    // Close interface
    output.push('}');
  }

  // Begin parsing top-level entries
  Object.entries(components.schemas).forEach((entry): void => {
    // Ignore top-level array definitions
    if (entry[1].type === 'object') {
      queue.push(entry);
    }
  });
  queue.sort((a, b) => a[0].localeCompare(b[0]));
  while (queue.length > 0) {
    buildNextInterface();
  }

  if (wrapper && shouldUseWrapper) {
    output.push('}'); // Close namespace
  }

  return prettier.format(output.join('\n'), { parser: 'typescript', singleQuote: true });
}

export default parse;
