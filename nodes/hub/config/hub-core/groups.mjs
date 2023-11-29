const groups = [
  {
    name: "testgroup",
    label: "First Test Group",
    userIds: [
      "test@testing.com"
    ],
  },
  {
    name: "dev",
    label: "Developer",
    userIds: ["developer1"],
    unmask: {
      outgoing: {
        '*': true,
      },
      /*
      incoming: {
        '*': true,
      },
      */
    },
  },
  {
    name: "admin",
    label: 'Admin',
    userIds: [
        "test@testing.com",
    ],
  },
  {
    name: "account",
    label: 'User Account',
    userIds: [
        'mark.hampton@ieee.org', 
    ],
  },
  {
    name: "sysadmin",
    label: 'System Admin',
    userIds: [
      "test@testing.com", 
    ],
  },
];
export { groups };