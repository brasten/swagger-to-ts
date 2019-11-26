import swagger2, { Swagger2, Swagger2Options } from './swagger-2';
import swagger3, { Swagger3 } from './swagger-3';

export interface Options extends Swagger2Options {
  swagger?: number;
}

export default function(spec: Swagger2 | Swagger3, options?: Options): string {
  const swagger = (options && options.swagger) || 2;

  if (![2, 3].includes(swagger)) {
    throw new Error(`Swagger version ${swagger} is not supported`);
  }

  return swagger === 2
    ? swagger2(spec as Swagger2, options)
    : swagger3(spec as Swagger3, options);
}
