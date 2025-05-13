import {
  z,
  ZodArray,
  ZodObject,
  ZodOptional,
  ZodTypeAny,
  ZodString,
  ZodNullable,
} from "zod";

/**
 * Checks if a schema is a ZodString with URL validation
 */
export function isUrlSchema(schema: ZodTypeAny): boolean {
  if (!(schema instanceof ZodString)) return false;

  // Check if schema has URL validation by checking for internal checks property
  // This is a bit of a hack but necessary since Zod doesn't expose validation info
  const checks = (schema as any)._def.checks;
  if (!checks || !Array.isArray(checks)) return false;

  return checks.some((check) => check.kind === "url");
}

/**
 * Transforms a schema, replacing any URL validations with string validations
 * for compatibility with LLM output
 */
export function transformSchemaForLLM<T extends ZodTypeAny>(
  schema: T
): ZodTypeAny {
  // For URL string schemas, remove the URL check but preserve everything else
  if (isUrlSchema(schema)) {
    const originalDef = { ...(schema as any)._def };

    // Filter out only URL checks, keep all other checks
    if (originalDef.checks && Array.isArray(originalDef.checks)) {
      originalDef.checks = originalDef.checks.filter(
        (check: any) => check.kind !== "url"
      );
    }

    // Create a new string schema with the modified definition
    return new z.ZodString({
      ...originalDef,
      typeName: z.ZodFirstPartyTypeKind.ZodString,
    });
  }

  // For object schemas, transform each property
  if (schema instanceof ZodObject) {
    const originalDef = { ...(schema as any)._def };
    const newShape: Record<string, ZodTypeAny> = {};

    // Transform each property in the shape
    for (const [key, propertySchema] of Object.entries(schema.shape)) {
      newShape[key] = transformSchemaForLLM(propertySchema as ZodTypeAny);
    }

    // Create a new object with the same definition but transformed shape
    return new z.ZodObject({
      ...originalDef,
      shape: () => newShape,
      typeName: z.ZodFirstPartyTypeKind.ZodObject,
    });
  }

  // For array schemas, transform the element schema
  if (schema instanceof ZodArray) {
    const originalDef = { ...(schema as any)._def };
    const transformedElement = transformSchemaForLLM(
      schema.element as ZodTypeAny
    );

    // Create a new array with the same definition but transformed element
    return new z.ZodArray({
      ...originalDef,
      type: transformedElement,
      typeName: z.ZodFirstPartyTypeKind.ZodArray,
    });
  }

  // For optional schemas, transform the inner schema
  if (schema instanceof ZodOptional) {
    const originalDef = { ...(schema as any)._def };
    const transformedInner = transformSchemaForLLM(
      schema.unwrap() as ZodTypeAny
    );

    // Create a new optional with the same definition but transformed inner type
    return new z.ZodOptional({
      ...originalDef,
      innerType: transformedInner,
      typeName: z.ZodFirstPartyTypeKind.ZodOptional,
    });
  }

  // For nullable schemas, transform the inner schema
  if (schema instanceof ZodNullable) {
    const originalDef = { ...(schema as any)._def };
    const transformedInner = transformSchemaForLLM(
      schema.unwrap() as ZodTypeAny
    );

    // Create a new nullable with the same definition but transformed inner type
    return new z.ZodNullable({
      ...originalDef,
      innerType: transformedInner,
      typeName: z.ZodFirstPartyTypeKind.ZodNullable,
    });
  }

  // Return the original schema for all other types
  return schema;
}

/**
 * Fix URL escape sequences in the object based on the original schema
 */
export function fixUrlEscapeSequences(data: any, schema: ZodTypeAny): any {
  if (data === null || data === undefined) return data;

  if (isUrlSchema(schema)) {
    if (typeof data === "string") {
      // Replace escaped parentheses with unescaped versions
      return data.replace(/\\\(/g, "(").replace(/\\\)/g, ")");
    }
    return data;
  }

  if (
    schema instanceof ZodObject &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    const shape = schema.shape;
    const result: Record<string, any> = {};

    for (const [key, propertySchema] of Object.entries(shape)) {
      if (key in data) {
        result[key] = fixUrlEscapeSequences(
          data[key],
          propertySchema as ZodTypeAny
        );
      } else {
        result[key] = data[key];
      }
    }

    return result;
  }

  if (schema instanceof ZodArray && Array.isArray(data)) {
    const elementSchema = schema.element as ZodTypeAny;
    return data.map((item) => fixUrlEscapeSequences(item, elementSchema));
  }

  if (schema instanceof ZodOptional) {
    const innerSchema = schema.unwrap() as ZodTypeAny;
    return fixUrlEscapeSequences(data, innerSchema);
  }

  if (schema instanceof ZodNullable) {
    const innerSchema = schema.unwrap() as ZodTypeAny;
    return fixUrlEscapeSequences(data, innerSchema);
  }

  return data;
}

/**
 * Sanitizes an object to conform to a Zod schema by removing invalid optional fields or array items.
 * If the object can't be sanitized to match the schema, returns null.
 *
 * @param schema The Zod schema to validate against
 * @param rawObject The raw object to sanitize
 * @returns The sanitized object or null if it can't be sanitized
 */
export function safeSanitizedParser<T extends ZodTypeAny>(
  schema: T,
  rawObject: unknown
): z.infer<T> | null {
  try {
    // If the raw object is null or undefined, just validate it directly
    if (rawObject === null || rawObject === undefined) {
      return schema.parse(rawObject);
    }

    // Handle different schema types
    if (schema instanceof ZodObject) {
      return sanitizeObject(schema, rawObject);
    } else if (schema instanceof ZodArray) {
      return sanitizeArray(schema, rawObject);
    } else if (schema instanceof ZodOptional) {
      return sanitizeOptional(schema, rawObject);
    } else if (schema instanceof ZodNullable) {
      return sanitizeNullable(schema, rawObject);
    } else {
      // For primitive values, try to parse directly
      return schema.parse(rawObject);
    }
  } catch (error) {
    // If any error occurs during sanitization, return null
    return null;
  }
}

/**
 * Sanitizes an object against a Zod object schema
 */
function sanitizeObject(schema: ZodObject<any>, rawObject: unknown): any {
  if (
    typeof rawObject !== "object" ||
    rawObject === null ||
    Array.isArray(rawObject)
  ) {
    throw new Error("Expected an object");
  }

  const shape = schema.shape;
  const result: Record<string, any> = {};
  const rawObjectRecord = rawObject as Record<string, unknown>;

  // Process each property in the schema
  for (const [key, propertySchema] of Object.entries(shape)) {
    // Skip if the property doesn't exist in the raw object
    if (!(key in rawObjectRecord)) {
      continue;
    }

    // If property is optional, try to sanitize it
    if (propertySchema instanceof ZodOptional) {
      const sanitized = safeSanitizedParser(
        propertySchema as ZodTypeAny,
        rawObjectRecord[key]
      );
      if (sanitized !== null) {
        result[key] = sanitized;
      }
      // If sanitization fails, just skip the optional property
    } else if (propertySchema instanceof ZodNullable) {
      // For nullable properties, try to sanitize or set to null
      try {
        const sanitized = safeSanitizedParser(
          propertySchema as ZodTypeAny,
          rawObjectRecord[key]
        );
        result[key] = sanitized;
      } catch {
        // If sanitization fails, set to null for nullable properties
        result[key] = null;
      }
    } else {
      // For required properties, try to sanitize and throw if it fails
      const sanitized = safeSanitizedParser(
        propertySchema as ZodTypeAny,
        rawObjectRecord[key]
      );
      if (sanitized === null) {
        throw new Error(`Required property ${key} could not be sanitized`);
      }
      result[key] = sanitized;
    }
  }

  // Validate the final object to ensure it matches the schema
  return schema.parse(result);
}

/**
 * Sanitizes an array against a Zod array schema
 */
function sanitizeArray(schema: ZodArray<any>, rawValue: unknown): any {
  if (!Array.isArray(rawValue)) {
    throw new Error("Expected an array");
  }

  const elementSchema = schema.element as ZodTypeAny;
  const sanitizedArray = [];

  // Process each item in the array
  for (const item of rawValue) {
    try {
      const sanitizedItem = safeSanitizedParser(elementSchema, item);
      if (sanitizedItem !== null) {
        sanitizedArray.push(sanitizedItem);
      }
      // If an item can't be sanitized, just skip it
    } catch {
      // Skip invalid array items
    }
  }

  // Validate the final array to ensure it matches the schema
  return schema.parse(sanitizedArray);
}

/**
 * Sanitizes a value against an optional Zod schema
 */
function sanitizeOptional(schema: ZodOptional<any>, rawValue: unknown): any {
  try {
    // Try to sanitize using the inner schema
    const innerSchema = schema.unwrap();
    return safeSanitizedParser(innerSchema, rawValue);
  } catch {
    // If sanitization fails, return undefined for optional values
    return undefined;
  }
}

/**
 * Sanitizes a value against a nullable Zod schema
 */
function sanitizeNullable(schema: ZodNullable<any>, rawValue: unknown): any {
  // If the value is null, return null directly
  if (rawValue === null) {
    return null;
  }

  try {
    // Try to sanitize using the inner schema
    const innerSchema = schema.unwrap();
    const sanitized = safeSanitizedParser(innerSchema, rawValue);

    // If sanitization of inner schema fails, return null
    if (sanitized === null) {
      return null;
    }

    return sanitized;
  } catch {
    // If sanitization fails, return null for nullable values
    return null;
  }
}
