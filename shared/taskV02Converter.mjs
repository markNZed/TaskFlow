// To parse this data:
//
//   const Convert = require("./file");
//
//   const taskV02Converter = Convert.toTaskConverter(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
function toTaskConverter(json) {
    return cast(JSON.parse(json), r("TaskConverter"));
}

function taskConverterToJson(value) {
    return JSON.stringify(uncast(value, r("TaskConverter")), null, 2);
}

function invalidValue(typ, val, key, parent = '') {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ) {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ) {
    if (typ.jsonToJS === undefined) {
        const map = {};
        typ.props.forEach((p) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ) {
    if (typ.jsToJSON === undefined) {
        const map = {};
        typ.props.forEach((p) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val, typ, getProps, key = '', parent = '') {
    function transformPrimitive(typ, val) {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs, val) {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases, val) {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ, val) {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val) {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props, additional, val) {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast(val, typ) {
    return transform(val, typ, jsonToJSProps);
}

function uncast(val, typ) {
    return transform(val, typ, jsToJSONProps);
}

function l(typ) {
    return { literal: typ };
}

function a(typ) {
    return { arrayItems: typ };
}

function u(...typs) {
    return { unionMembers: typs };
}

function o(props, additional) {
    return { props, additional };
}

function m(additional) {
    return { props: [], additional };
}

function r(name) {
    return { ref: name };
}

const typeMap = {
    "TaskConverter": o([
        { json: "command", js: "command", typ: u(undefined, u(null, "")) },
        { json: "commandArgs", js: "commandArgs", typ: u(undefined, u(m("any"), null)) },
        { json: "config", js: "config", typ: u(undefined, m("any")) },
        { json: "error", js: "error", typ: u(undefined, u(m("any"), null)) },
        { json: "familyId", js: "familyId", typ: u(undefined, "") },
        { json: "groupId", js: "groupId", typ: u(undefined, "") },
        { json: "hub", js: "hub", typ: u(undefined, m("any")) },
        { json: "id", js: "id", typ: u(undefined, "") },
        { json: "input", js: "input", typ: u(undefined, m("any")) },
        { json: "meta", js: "meta", typ: u(undefined, m("any")) },
        { json: "name", js: "name", typ: u(undefined, "") },
        { json: "output", js: "output", typ: u(undefined, m("any")) },
        { json: "parentName", js: "parentName", typ: u(undefined, "") },
        { json: "permissions", js: "permissions", typ: u(undefined, a("")) },
        { json: "privacy", js: "privacy", typ: u(undefined, m("any")) },
        { json: "processor", js: "processor", typ: u(undefined, m("any")) },
        { json: "processors", js: "processors", typ: u(undefined, m("any")) },
        { json: "request", js: "request", typ: u(undefined, m("any")) },
        { json: "response", js: "response", typ: u(undefined, m("any")) },
        { json: "state", js: "state", typ: u(undefined, r("State")) },
        { json: "type", js: "type", typ: u(undefined, "") },
        { json: "user", js: "user", typ: u(undefined, m("any")) },
        { json: "users", js: "users", typ: u(undefined, m("any")) },
        { json: "versionExternal", js: "versionExternal", typ: u(undefined, "") },
        { json: "versionInternal", js: "versionInternal", typ: u(undefined, "") },
    ], "any"),
    "State": o([
        { json: "current", js: "current", typ: u(undefined, "") },
        { json: "done", js: "done", typ: u(undefined, true) },
        { json: "id", js: "id", typ: u(undefined, "") },
        { json: "last", js: "last", typ: u(undefined, "") },
        { json: "nextState", js: "nextState", typ: u(undefined, "") },
        { json: "request", js: "request", typ: u(undefined, m("any")) },
        { json: "response", js: "response", typ: u(undefined, m("any")) },
    ], "any"),
};

export {
    taskConverterToJson,
    toTaskConverter,
};
