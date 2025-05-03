import { z } from "zod";
import { safeSanitizedParser } from "../../src/utils/schemaUtils";

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
  });
});
