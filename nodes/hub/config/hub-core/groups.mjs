const groups = [
    {
      name: "testgroup",
      label: "First Test Group",
      users: ["test@testing.com"],
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
];
export { groups };