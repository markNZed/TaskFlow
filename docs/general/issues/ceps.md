# CEPs

The CEPs configured by a Task are installed after the init phase. On the Coprocessor a CEP can be installed during init and will be available when the command is dispatched but in the case of other nodes the CEP will be installed after the init command is processed. If the CEP needs to act on the init of the Task that also configures it then this is only possible on the Coprocessor. It would be better to install the CEP before the init command is processed on all nodes so the behavior is consistent.
