module.exports = {
    "env": {
        "browser": true,
        "es2021": true,
        "node": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:xstate/recommended_v4",
    ],
    "overrides": [
        {
            "env": {
                "node": true
            },
            "files": [
                ".eslintrc.{js,cjs}"
            ],
            "parserOptions": {
                "sourceType": "script"
            }
        }
    ],
    "parser": "@babel/eslint-parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module",
        "requireConfigFile": false,
        "babelOptions": {
            "plugins": [
            "@babel/plugin-syntax-import-assertions"
            ]
        }
    },
    "plugins": [
        "react",
        "xstate",
    ],
    "rules": {
        'xstate/prefer-predictable-action-arguments': 'off',
    }
}
