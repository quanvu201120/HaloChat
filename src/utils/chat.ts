export function normalizeId(value: unknown): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    const objectValue = value as { _id?: unknown; $oid?: unknown };

    if (typeof objectValue._id === 'string') {
      return objectValue._id;
    }

    if (typeof objectValue.$oid === 'string') {
      return objectValue.$oid;
    }
  }

  return String(value);
}

export function normalizeReadReceipts(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [userId, messageId]) => {
      const normalizedMessageId = normalizeId(messageId);
      if (userId && normalizedMessageId) {
        acc[userId] = normalizedMessageId;
      }
      return acc;
    },
    {},
  );
}
