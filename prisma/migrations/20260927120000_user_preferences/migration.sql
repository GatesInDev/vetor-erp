CREATE TABLE "UserPreference" (
    "userId" UUID NOT NULL,
    "theme" VARCHAR(5) NOT NULL DEFAULT 'dark',
    "locale" VARCHAR(5) NOT NULL DEFAULT 'pt-BR',
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "loadedScreenLimit" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "UserPreference_theme_check" CHECK ("theme" IN ('light', 'dark')),
    CONSTRAINT "UserPreference_locale_check" CHECK ("locale" IN ('pt-BR', 'en-US')),
    CONSTRAINT "UserPreference_decimalPlaces_check" CHECK ("decimalPlaces" BETWEEN 0 AND 6),
    CONSTRAINT "UserPreference_loadedScreenLimit_check" CHECK ("loadedScreenLimit" BETWEEN 1 AND 8)
);

ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
