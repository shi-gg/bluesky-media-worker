import { base, recommended, strict } from '@mwlica/eslint';
import tseslint from "typescript-eslint";

export default tseslint.config(
    base,
    recommended,
    strict,
    {
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
    }
);