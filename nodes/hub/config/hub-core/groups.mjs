const groups = [
  {
    name: "testgroup",
    label: "First Test Group",
    users: [
      "test@testing.com"
    ],
  },
  {
    name: "dev",
    label: "Developer",
    users: ["developer1"],
    unmask: {
      outgoing: {
        '*': true,
      },
      incoming: {
        '*': true,
      },
    },
  },
  {
    name: "admin",
    label: 'Admin',
    users: [
        "test@testing.com",
    ],
  },
  {
    name: "account",
    label: 'User Account',
    users: [
        'mark.hampton@ieee.org', 
    ],
  },
  {
    name: "sysadmin",
    label: 'System Admin',
    users: [
      "test@testing.com", 
    ],
  },
];
export { groups };