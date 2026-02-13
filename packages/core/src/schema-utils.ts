/**
 * Utility to convert Zod schemas to JSON Schema for MCP
 * Simplified converter for the Zod types we use
 */

import { z } from 'zod';

export function zodToJsonSchema(schema: z.ZodType<any>): any {
  const def = schema._def as any; // Cast to any for dynamic property access
  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodObject': {
      const shape = def.shape();
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodType<any>);

        // Check if field is required (not optional)
        const fieldDef = (value as z.ZodType<any>)._def;
        if (fieldDef.typeName !== 'ZodOptional' && fieldDef.typeName !== 'ZodDefault') {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    case 'ZodString': {
      const result: any = { type: 'string' };

      // Check for email validation
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'email') {
            result.format = 'email';
          } else if (check.kind === 'url') {
            result.format = 'uri';
          } else if (check.kind === 'regex') {
            result.pattern = check.regex.source;
          } else if (check.kind === 'min') {
            result.minLength = check.value;
          } else if (check.kind === 'max') {
            result.maxLength = check.value;
          }
        }
      }

      return result;
    }

    case 'ZodNumber': {
      const result: any = { type: 'number' };

      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'int') {
            result.type = 'integer';
          } else if (check.kind === 'min') {
            result.minimum = check.value;
          } else if (check.kind === 'max') {
            result.maximum = check.value;
          }
        }
      }

      return result;
    }

    case 'ZodBoolean':
      return { type: 'boolean' };

    case 'ZodArray': {
      const items = zodToJsonSchema(def.type);
      const result: any = { type: 'array', items };

      if (def.minLength) {
        result.minItems = def.minLength.value;
      }
      if (def.maxLength) {
        result.maxItems = def.maxLength.value;
      }

      return result;
    }

    case 'ZodEnum': {
      return {
        type: 'string',
        enum: def.values,
      };
    }

    case 'ZodOptional':
      return zodToJsonSchema(def.innerType);

    case 'ZodDefault': {
      const innerSchema = zodToJsonSchema(def.innerType);
      innerSchema.default = def.defaultValue();
      return innerSchema;
    }

    case 'ZodRecord': {
      return {
        type: 'object',
        additionalProperties: zodToJsonSchema(def.valueType),
      };
    }

    case 'ZodUnion':
    case 'ZodDiscriminatedUnion': {
      return {
        anyOf: def.options.map((option: z.ZodType<any>) => zodToJsonSchema(option)),
      };
    }

    case 'ZodLiteral': {
      return {
        type: typeof def.value,
        const: def.value,
      };
    }

    case 'ZodAny':
      return {};

    default:
      // Fallback for unsupported types
      return { type: 'object' };
  }
}
