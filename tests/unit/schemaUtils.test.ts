import { z } from "zod";
import {
  safeSanitizedParser,
  transformSchemaForLLM,
  fixUrlEscapeSequences,
} from "../../src/utils/schemaUtils";

describe("safeSanitizedParser", () => {
  describe("Basic Functionality", () => {
    test("should return valid data as is", () => {
      const schema = z.string();
      const result = safeSanitizedParser(schema, "test");
      expect(result).toBe("test");
    });

    test("should return null for invalid data", () => {
      const schema = z.number();
      const result = safeSanitizedParser(schema, "not a number");
      expect(result).toBeNull();
    });
  });

  describe("Object Schemas", () => {
    test("should keep valid required properties", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.number().optional(),
      });

      const data = { required: "value", optional: 123 };
      const result = safeSanitizedParser(schema, data);

      expect(result).toEqual(data);
    });

    test("should remove invalid optional properties", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.number().optional(),
      });

      const data = { required: "value", optional: "not a number" };
      const expected = { required: "value" };

      const result = safeSanitizedParser(schema, data);
      expect(result).toEqual(expected);
    });

    test("should return null if required property is invalid", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.number().optional(),
      });

      const data = { required: 123, optional: 456 };
      const result = safeSanitizedParser(schema, data);

      expect(result).toBeNull();
    });

    test("should handle nested objects", () => {
      const schema = z.object({
        nested: z.object({
          required: z.string(),
          optional: z.number().optional(),
        }),
      });

      const data = {
        nested: {
          required: "value",
          optional: "not a number",
        },
      };

      const expected = {
        nested: {
          required: "value",
        },
      };

      const result = safeSanitizedParser(schema, data);
      expect(result).toEqual(expected);
    });

    test("should return null if nested required property is invalid", () => {
      const schema = z.object({
        nested: z.object({
          required: z.string(),
        }),
      });

      const data = { nested: { required: 123 } };
      const result = safeSanitizedParser(schema, data);

      expect(result).toBeNull();
    });
  });

  describe("Array Schemas", () => {
    test("should keep valid array items", () => {
      const schema = z.array(z.number());
      const data = [1, 2, 3];

      const result = safeSanitizedParser(schema, data);
      expect(result).toEqual(data);
    });

    test("should filter out invalid array items", () => {
      const schema = z.array(z.number());
      const data = [1, "two", 3, "four", 5];
      const expected = [1, 3, 5];

      const result = safeSanitizedParser(schema, data);
      expect(result).toEqual(expected);
    });

    test("should handle arrays of objects", () => {
      const schema = z.array(
        z.object({
          id: z.number(),
          name: z.string(),
        })
      );

      const data = [
        { id: 1, name: "Valid" },
        { id: "2", name: "Invalid ID" },
        { id: 3, name: 123 },
        { id: 4, name: "Valid Again" },
      ];

      const expected = [
        { id: 1, name: "Valid" },
        { id: 4, name: "Valid Again" },
      ];

      const result = safeSanitizedParser(schema, data);
      expect(result).toEqual(expected);
    });

    test("should handle nested arrays", () => {
      const schema = z.array(z.array(z.number()));

      const data = [
        [1, 2, 3],
        [4, "five", 6],
        ["seven", "eight", "nine"],
        [10, 11, 12],
      ];

      const expected = [[1, 2, 3], [4, 6], [], [10, 11, 12]];

      const result = safeSanitizedParser(schema, data);
      expect(result).toEqual(expected);
    });
  });

  describe("Handling Unsafe Data", () => {
    describe("Unsafe Optional Fields", () => {
      test("should remove unsafe optional fields with constraints", () => {
        const schema = z.object({
          id: z.number(),
          name: z.string(),
          email: z.string().email().optional(),
          age: z.number().min(0).max(120).optional(),
          tags: z.array(z.string()).optional(),
        });

        const data = {
          id: 1,
          name: "Test User",
          email: "not-an-email", // invalid email format
          age: 200, // exceeds max
          tags: ["tag1", "tag2"],
        };

        const expected = {
          id: 1,
          name: "Test User",
          tags: ["tag1", "tag2"],
        };

        const result = safeSanitizedParser(schema, data);
        expect(result).toEqual(expected);
      });

      test("should remove invalid optional nested objects", () => {
        const schema = z.object({
          user: z.object({
            id: z.number(),
            name: z.string(),
          }),
          metadata: z
            .object({
              created: z.string().datetime(),
              lastUpdated: z.string().datetime().optional(),
            })
            .optional(),
          settings: z
            .object({
              theme: z.enum(["light", "dark"]),
              notifications: z.boolean(),
            })
            .optional(),
        });

        const data = {
          user: {
            id: 1,
            name: "Test User",
          },
          metadata: {
            created: "2023-01-01T10:00:00Z",
            lastUpdated: "not-a-date", // invalid
          },
          settings: {
            theme: "blue", // invalid enum
            notifications: true,
          },
        };

        const expected = {
          user: {
            id: 1,
            name: "Test User",
          },
          metadata: {
            created: "2023-01-01T10:00:00Z",
          },
        };

        const result = safeSanitizedParser(schema, data);
        expect(result).toEqual(expected);
      });
    });

    describe("Unsafe Array Items", () => {
      test("should filter out unsafe items from arrays with constraints", () => {
        const schema = z.object({
          numbers: z.array(z.number().int().positive()),
        });

        const data = {
          numbers: [1, 2, -3, 4.5, "6", 7, 0, null, 8],
          //         ✓  ✓   ✗    ✗    ✗   ✓  ✗   ✗   ✓
        };

        const expected = {
          numbers: [1, 2, 7, 8],
        };

        const result = safeSanitizedParser(schema, data);
        expect(result).toEqual(expected);
      });

      test("should filter out unsafe items from arrays of objects with enums", () => {
        const schema = z.object({
          users: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              role: z.enum(["admin", "user", "guest"]),
            })
          ),
        });

        const data = {
          users: [
            { id: 1, name: "Alice", role: "admin" }, // valid
            { id: "2", name: "Bob", role: "user" }, // invalid id
            { id: 3, name: 123, role: "guest" }, // invalid name
            { id: 4, name: "Dave", role: "moderator" }, // invalid role
            { id: 5, name: "Eve", role: "admin" }, // valid
          ],
        };

        const expected = {
          users: [
            { id: 1, name: "Alice", role: "admin" },
            { id: 5, name: "Eve", role: "admin" },
          ],
        };

        const result = safeSanitizedParser(schema, data);
        expect(result).toEqual(expected);
      });
    });

    describe("Complex Nested Structures", () => {
      test("should sanitize nested arrays of arrays", () => {
        const schema = z.object({
          groups: z.array(
            z.array(
              z.object({
                id: z.number(),
                value: z.string(),
              })
            )
          ),
        });

        const data = {
          groups: [
            [
              { id: 1, value: "a" },
              { id: "2", value: "b" }, // invalid id
              { id: 3, value: "c" },
            ],
            [
              { id: 4, value: 5 }, // invalid value
              { id: 6, value: "f" },
            ],
            [
              { name: "wrong key" }, // completely wrong structure
              { id: 7, value: "g" },
            ],
          ],
        };

        const expected = {
          groups: [
            [
              { id: 1, value: "a" },
              { id: 3, value: "c" },
            ],
            [{ id: 6, value: "f" }],
            [{ id: 7, value: "g" }],
          ],
        };

        const result = safeSanitizedParser(schema, data);
        expect(result).toEqual(expected);
      });

      test("should handle deeply nested blog structure with invalid data", () => {
        const tagSchema = z.object({
          id: z.number(),
          name: z.string(),
        });

        const commentSchema = z.object({
          id: z.number(),
          text: z.string(),
          author: z.string(),
          replies: z
            .array(
              z.object({
                id: z.number(),
                text: z.string(),
              })
            )
            .optional(),
        });

        const postSchema = z.object({
          id: z.number(),
          title: z.string(),
          content: z.string(),
          published: z.boolean(),
          tags: z.array(tagSchema).optional(),
          comments: z.array(commentSchema).optional(),
          metadata: z
            .object({
              views: z.number(),
              likes: z.number(),
              featured: z.boolean().optional(),
            })
            .optional(),
        });

        const blogSchema = z.object({
          posts: z.array(postSchema),
        });

        const data = {
          posts: [
            {
              id: 1,
              title: "First Post",
              content: "Content here",
              published: true,
              tags: [
                { id: 1, name: "tag1" },
                { id: "2", name: "tag2" }, // invalid id
                { id: 3, name: 5 }, // invalid name
              ],
              comments: [
                {
                  id: 1,
                  text: "Great post!",
                  author: "User1",
                  replies: [
                    { id: 1, text: "Thanks!" },
                    { id: "2", text: "Welcome!" }, // invalid id
                  ],
                },
                {
                  id: "2", // invalid id
                  text: "Nice work",
                  author: "User2",
                  replies: [],
                },
              ],
              metadata: {
                views: "100", // invalid number
                likes: 42,
                featured: "yes", // invalid boolean
              },
            },
            {
              id: 2,
              title: "Second Post",
              content: 12345, // invalid content
              published: "false", // invalid boolean
              tags: "not-an-array", // invalid array
              metadata: {
                views: 200,
                likes: 78,
              },
            },
          ],
        };

        // The expected sanitized result
        const expected = {
          posts: [
            {
              id: 1,
              title: "First Post",
              content: "Content here",
              published: true,
              tags: [{ id: 1, name: "tag1" }],
              comments: [
                {
                  id: 1,
                  text: "Great post!",
                  author: "User1",
                  replies: [{ id: 1, text: "Thanks!" }],
                },
              ],
            },
          ],
        };

        const result = safeSanitizedParser(blogSchema, data);
        expect(result).toEqual(expected);
      });
    });

    test("should handle schema similar to the OutputFormat example", () => {
      // Define schema similar to the one in the user query
      const outputFormatSchema = z.object({
        preference: z.string(),
        sentence_preference_revealed: z.string(),
      });

      const telegramPreferencesSchema = z.object({
        preferred_encoding: z.array(outputFormatSchema).optional(),
        favorite_telegram_operators: z.array(outputFormatSchema).optional(),
      });

      const userPreferencesSchema = z.object({
        telegram: telegramPreferencesSchema,
        other_preferences: z.record(z.string(), z.any()).optional(),
      });

      const data = {
        telegram: {
          preferred_encoding: [
            { preference: "valid", sentence_preference_revealed: "valid text" },
            {
              preference: 123,
              sentence_preference_revealed: "invalid pref type",
            }, // Invalid
            { preference: "valid2", sentence_preference_revealed: 456 }, // Invalid
          ],
          favorite_telegram_operators: [
            { preference: "valid", sentence_preference_revealed: "valid text" },
            { some_other_field: "missing required fields" }, // Invalid
          ],
        },
        other_preferences: {
          something: "value",
        },
      };

      const expected = {
        telegram: {
          preferred_encoding: [
            { preference: "valid", sentence_preference_revealed: "valid text" },
          ],
          favorite_telegram_operators: [
            { preference: "valid", sentence_preference_revealed: "valid text" },
          ],
        },
        other_preferences: {
          something: "value",
        },
      };

      const result = safeSanitizedParser(userPreferencesSchema, data);
      expect(result).toEqual(expected);
    });

    test("should handle product catalog with realistic validation issues", () => {
      // Define a product catalog schema (from README example)
      const productSchema = z.object({
        products: z.array(
          z.object({
            id: z.number(),
            name: z.string(), // Required field
            price: z.number().optional(), // Optional number
            inStock: z.boolean().optional(),
            category: z.string().optional(),
          })
        ),
        storeInfo: z.object({
          name: z.string(),
          location: z.string().optional(),
          rating: z.number().min(0).max(5).optional(),
        }),
      });

      // Example LLM output with realistic validation issues
      const rawLLMOutput = {
        products: [
          {
            id: 1,
            name: "Laptop",
            price: 999,
            inStock: true,
          }, // Valid product
          {
            id: 2,
            name: "Headphones",
            price: "N/A", // Non-convertible string for optional number
            inStock: true,
            category: "Audio",
          },
          {
            id: 3,
            // Missing required 'name' field
            price: 45.99,
            inStock: false,
          },
          {
            id: 4,
            name: "Keyboard",
            price: 59.99,
            inStock: true,
          }, // Valid product
        ],
        storeInfo: {
          name: "TechStore",
          location: "123 Main St",
          rating: "N/A", // Invalid: rating is not a number
        },
      };

      // Expected sanitized result
      const expected = {
        products: [
          {
            id: 1,
            name: "Laptop",
            price: 999,
            inStock: true,
          },
          {
            id: 2,
            name: "Headphones",
            inStock: true,
            category: "Audio",
          },
          {
            id: 4,
            name: "Keyboard",
            price: 59.99,
            inStock: true,
          },
        ],
        storeInfo: {
          name: "TechStore",
          location: "123 Main St",
        },
      };

      const result = safeSanitizedParser(productSchema, rawLLMOutput);
      expect(result).toEqual(expected);
    });
  });
});

describe("transformSchemaForLLM", () => {
  test("should convert z.string().url() to z.string() while preserving description exactly", () => {
    const original = z.string().url().describe("Link to product");
    const transformed = transformSchemaForLLM(original);

    // Should still be a string schema
    expect(transformed instanceof z.ZodString).toBe(true);

    // Description should be preserved exactly
    expect((transformed as any)._def.description).toBe("Link to product");

    // URL check should be removed
    const checks = (transformed as any)._def.checks || [];
    const hasUrlCheck = checks.some((check: any) => check.kind === "url");
    expect(hasUrlCheck).toBe(false);

    // Test it accepts a string that's not a URL (which the original would reject)
    expect(() => transformed.parse("not-a-url")).not.toThrow();
    expect(() => original.parse("not-a-url")).toThrow();
  });

  test("should handle nested objects with URL fields", () => {
    const original = z.object({
      user: z.object({
        profile: z.string().url().describe("Profile URL"),
      }),
      website: z.string().min(5).url().optional(),
    });

    const transformed = transformSchemaForLLM(original);

    // Check structure is preserved
    expect(transformed instanceof z.ZodObject).toBe(true);

    // Access shape correctly based on internal Zod structure
    const shape = (transformed as any)._def.shape();
    expect(shape.user).toBeDefined();
    expect(shape.website).toBeDefined();

    // Check nested URL is transformed but description is preserved exactly
    const profileSchema = shape.user._def.shape().profile;
    expect(profileSchema instanceof z.ZodString).toBe(true);
    expect(profileSchema._def.description).toBe("Profile URL");

    // Check optional URL is transformed but remains optional
    expect(shape.website instanceof z.ZodOptional).toBe(true);
    const innerType = shape.website._def.innerType;
    expect(innerType instanceof z.ZodString).toBe(true);

    // Verify min check is preserved
    const hasMinCheck = innerType._def.checks.some(
      (check: any) => check.kind === "min"
    );
    expect(hasMinCheck).toBe(true);
  });

  test("should handle arrays of URL fields", () => {
    const original = z.array(z.string().url().describe("Resource URL"));
    const transformed = transformSchemaForLLM(original);

    expect(transformed instanceof z.ZodArray).toBe(true);

    // Element should be a string without URL validation
    const elementSchema = (transformed as any)._def.type;
    expect(elementSchema instanceof z.ZodString).toBe(true);

    // Description should be preserved exactly if provided
    expect(elementSchema._def.description).toBe("Resource URL");

    // Should accept non-URL strings now
    const testArray = ["not-a-url", "also-not-a-url"];
    expect(() => transformed.parse(testArray)).not.toThrow();
    expect(() => original.parse(testArray)).toThrow();
  });

  test("should preserve descriptions on array schemas", () => {
    const original = z
      .array(z.string().url())
      .describe("Collection of resource URLs");
    const transformed = transformSchemaForLLM(original);

    // Should still be an array schema
    expect(transformed instanceof z.ZodArray).toBe(true);

    // Description should be preserved exactly
    expect((transformed as any)._def.description).toBe(
      "Collection of resource URLs"
    );

    // Element schema should be transformed but maintain its properties
    const elementSchema = (transformed as any).element;
    expect(elementSchema instanceof z.ZodString).toBe(true);

    // Array should now accept non-URL strings
    expect(() =>
      transformed.parse(["not-a-url", "also-not-a-url"])
    ).not.toThrow();
    expect(() => original.parse(["not-a-url", "also-not-a-url"])).toThrow();
  });

  test("should preserve descriptions on object schemas", () => {
    const original = z
      .object({
        link: z.string().url(),
      })
      .describe("Resource metadata");
    const transformed = transformSchemaForLLM(original);

    // Should still be an object schema
    expect(transformed instanceof z.ZodObject).toBe(true);

    // Description should be preserved exactly
    expect((transformed as any)._def.description).toBe("Resource metadata");

    // Properties should be transformed but maintain their properties
    const props = (transformed as any)._def.shape();
    expect(props.link instanceof z.ZodString).toBe(true);

    // Object should now accept non-URL strings in properties
    expect(() => transformed.parse({ link: "not-a-url" })).not.toThrow();
    expect(() => original.parse({ link: "not-a-url" })).toThrow();
  });

  test("should preserve descriptions on optional schemas", () => {
    const original = z
      .optional(z.string().url())
      .describe("Optional resource URL");
    const transformed = transformSchemaForLLM(original);

    // Should still be an optional schema
    expect(transformed instanceof z.ZodOptional).toBe(true);

    // Description should be preserved exactly
    expect((transformed as any)._def.description).toBe("Optional resource URL");

    // Inner schema should be transformed but maintain its properties
    const innerSchema = (transformed as any)._def.innerType;
    expect(innerSchema instanceof z.ZodString).toBe(true);

    // Optional should now accept non-URL strings or undefined
    expect(() => transformed.parse("not-a-url")).not.toThrow();
    expect(() => transformed.parse(undefined)).not.toThrow();
    expect(() => original.parse("not-a-url")).toThrow();
    expect(() => original.parse(undefined)).not.toThrow();
  });

  test("should handle deeply nested schemas with descriptions at each level", () => {
    // Create a complex schema with descriptions at multiple levels
    const original = z
      .object({
        user: z
          .object({
            profile: z.string().url().describe("User profile URL"),
          })
          .describe("User information"),
        resources: z
          .array(
            z
              .object({
                type: z.string(),
                link: z.string().url().describe("Resource link"),
              })
              .describe("Resource item")
          )
          .describe("Available resources"),
        metadata: z
          .optional(
            z
              .object({
                lastUpdated: z.string(),
                mainLink: z.string().url().describe("Main resource"),
              })
              .describe("Metadata information")
          )
          .describe("Optional metadata"),
      })
      .describe("Complete resource object");

    const transformed = transformSchemaForLLM(original);

    // Verify top-level description
    expect((transformed as any)._def.description).toBe(
      "Complete resource object"
    );

    // Verify nested object description
    const shape = (transformed as any)._def.shape();
    expect(shape.user._def.description).toBe("User information");

    // Verify array description
    expect(shape.resources._def.description).toBe("Available resources");

    // Verify description inside array elements
    // Access element schema correctly based on internal Zod structure
    const resourceElement = (shape.resources as any)._def.type;
    expect(resourceElement._def.description).toBe("Resource item");

    // Verify optional description
    expect(shape.metadata._def.description).toBe("Optional metadata");

    // Verify description inside optional
    const metadataSchema = shape.metadata._def.innerType;
    expect(metadataSchema._def.description).toBe("Metadata information");

    // Verify URL field descriptions are preserved
    expect(shape.user._def.shape().profile._def.description).toBe(
      "User profile URL"
    );
    expect(resourceElement._def.shape().link._def.description).toBe(
      "Resource link"
    );
    expect(metadataSchema._def.shape().mainLink._def.description).toBe(
      "Main resource"
    );

    // Test that the schema accepts non-URL values now
    const testObj = {
      user: {
        profile: "not-a-url",
      },
      resources: [
        {
          type: "document",
          link: "not-a-url",
        },
      ],
      metadata: {
        lastUpdated: "2023-01-01",
        mainLink: "not-a-url",
      },
    };

    expect(() => transformed.parse(testObj)).not.toThrow();
    expect(() => original.parse(testObj)).toThrow();
  });
});

describe("fixUrlEscapeSequences", () => {
  test("should unescape parentheses in URL strings", () => {
    const schema = z.string().url();
    const escapedUrl = "https://example.com/meeting-\\(2023\\)";
    const fixed = fixUrlEscapeSequences(escapedUrl, schema);

    expect(fixed).toBe("https://example.com/meeting-(2023)");
  });

  test("should handle arrays of URLs", () => {
    const schema = z.array(z.string().url());
    const escapedUrls = [
      "https://example.com/path-\\(1\\)",
      "https://example.com/path-\\(2\\)",
    ];
    const fixed = fixUrlEscapeSequences(escapedUrls, schema);

    expect(fixed).toEqual([
      "https://example.com/path-(1)",
      "https://example.com/path-(2)",
    ]);
  });

  test("should handle nested objects with URL fields", () => {
    const schema = z.object({
      profile: z.string().url(),
      links: z.array(z.string().url()),
    });

    const data = {
      profile: "https://example.com/user-\\(john\\)",
      links: [
        "https://example.com/article-\\(1\\)",
        "https://example.com/article-\\(2\\)",
      ],
    };

    const fixed = fixUrlEscapeSequences(data, schema);

    expect(fixed).toEqual({
      profile: "https://example.com/user-(john)",
      links: [
        "https://example.com/article-(1)",
        "https://example.com/article-(2)",
      ],
    });
  });
});
