// To parse this data:
//
//   const Convert = require("./file");
//
//   const taskV01Converter = Convert.toTaskV01Converter(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
function toTaskConverter(json) {
    return cast(JSON.parse(json), r("TaskV01Converter"));
}

function taskConverterToJson(value) {
    return JSON.stringify(uncast(value, r("TaskV01Converter")), null, 2);
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
    "TaskV01Converter": o([
        { json: "agent", js: "agent", typ: u(undefined, "") },
        { json: "assemble_prompt", js: "assemble_prompt", typ: u(undefined, a("")) },
        { json: "children", js: "children", typ: u(undefined, a("any")) },
        { json: "client_prompt", js: "client_prompt", typ: u(undefined, "") },
        { json: "component", js: "component", typ: u(undefined, a("")) },
        { json: "component_depth", js: "component_depth", typ: 0 },
        { json: "created", js: "created", typ: u(undefined, "") },
        { json: "delta_step", js: "delta_step", typ: u(undefined, "") },
        { json: "done", js: "done", typ: u(undefined, true) },
        { json: "forget", js: "forget", typ: u(undefined, true) },
        { json: "groupId", js: "groupId", typ: u(undefined, "") },
        { json: "groups", js: "groups", typ: u(undefined, a("any")) },
        { json: "id", js: "id", typ: "" },
        { json: "input", js: "input", typ: u(undefined, "") },
        { json: "input_label", js: "input_label", typ: u(undefined, "") },
        { json: "instanceId", js: "instanceId", typ: u(undefined, "") },
        { json: "instruction", js: "instruction", typ: u(undefined, "") },
        { json: "label", js: "label", typ: u(undefined, "") },
        { json: "last_change", js: "last_change", typ: u(undefined, "") },
        { json: "menu", js: "menu", typ: u(undefined, true) },
        { json: "messages", js: "messages", typ: u(undefined, a(r("Message"))) },
        { json: "messages_template", js: "messages_template", typ: u(undefined, a(r("MessagesTemplate"))) },
        { json: "name", js: "name", typ: u(undefined, "") },
        { json: "next", js: "next", typ: u(undefined, "") },
        { json: "next_step", js: "next_step", typ: u(undefined, "") },
        { json: "one_thread", js: "one_thread", typ: u(undefined, true) },
        { json: "parent", js: "parent", typ: u(undefined, "") },
        { json: "parentId", js: "parentId", typ: u(undefined, "") },
        { json: "parentInstanceId", js: "parentInstanceId", typ: u(undefined, "") },
        { json: "prompt", js: "prompt", typ: u(undefined, "") },
        { json: "response", js: "response", typ: u(undefined, "") },
        { json: "sessionId", js: "sessionId", typ: u(undefined, "") },
        { json: "startId", js: "startId", typ: u(undefined, "") },
        { json: "step", js: "step", typ: u(undefined, "") },
        { json: "steps", js: "steps", typ: u(undefined, m("")) },
        { json: "suggested_prompts", js: "suggested_prompts", typ: u(undefined, a("")) },
        { json: "threadId", js: "threadId", typ: u(undefined, "") },
        { json: "update", js: "update", typ: u(undefined, true) },
        { json: "update_count", js: "update_count", typ: u(undefined, 0) },
        { json: "updated", js: "updated", typ: u(undefined, true) },
        { json: "updating", js: "updating", typ: u(undefined, true) },
        { json: "userId", js: "userId", typ: u(undefined, "") },
        { json: "welcome_message", js: "welcome_message", typ: u(undefined, "") },
    ], false),
    "Message": o([
        { json: "content", js: "content", typ: a("") },
        { json: "role", js: "role", typ: "" },
    ], "any"),
    "MessagesTemplate": o([
        { json: "content", js: "content", typ: a("") },
        { json: "role", js: "role", typ: "" },
    ], "any"),
};

export {
    taskConverterToJson,
    toTaskConverter,
};
