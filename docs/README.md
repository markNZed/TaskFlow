# T@skFlow Documentation Introduction

At this stage, this documentation is intended for developers[^1], not end users. Please see the top level [README](../README.md) for a general overview. This documentation provides technical information and some context of where T@skFlow (TF) is coming from, so you might have a better idea of where is is going to.

There are many perspectives from which TF could be documented e.g. starting with the Task object, different Node types, system features, etc. The approach taken here is to provide documentation for a reader in a particular role:

* **Application developer** - configures TF to combine different Tasks into an application for an end user. Typically the end user interacts with TF through a GUI but we can also imagine software developers using an API or building another TF application "on top of" TF applications.
* **Function developer** - develops Tasks that  provides functionality for a taskflow. A Task may be distributed on multiple nodes.
* **Node developer** - builds or extends a node to provide services for Tasks.
* **TF developer** - extends core functionality of TF such as the structure of Task objects, protocols for using Task objects, performance improvements, etc.

For each of these roles the intention is to provide documentation of features and conventions. There is a trade-off in limiting features so they can only be used in a particular way or providing flexibility while assuming developers will follow conventions. The preference in TF is to follow conventions.

When information is relevant to multiple roles we try to keep the documentation DRY by referencing specifications. Specifications define features without assuming the specific role of the reader. For example, features implemented by the TF developer are used by the application developer, both developers can refer to a common specification, while information for the TF developer will be about how the feature is implemented and information for the application developer will be about how the feature is used.

The documentation has been split into directories with README providing introductions.

* [README](./application/README.md) for the application developer
* [README](./function/README.md) for the function developer
* [README](./node/README.md) for the node developer
* [README](./tf/README.md) for the TF developer
* [README](./general/README.md) for all developers

One of the most time consuming aspects of developing new functionality is debug. It is critical to build debug features for developers as part of TF. There should be TF applications for each developer role to assist in development and debug.

## Why invest in T@skFlow?

At this stage the primary user of TF will be a developer and TF will be successful if it allows a developer to be either more productive or build something they otherwise could not build. The strategy of TF is to make hard things possible rather than making easy things easier. Most AI related frameworks are intended to make development more accessible and this is a very good thing, TF intends to use those systems rather than compete with them. There are philosophical and technical barriers that make TF a niche solution for now.

From an end user perspective TF may appear similar to other applications. In the medium term TF Nodes running on each of the user's devices (e.g., phone, PC, web browser, smart watch, personal server, ...) may seem different from most other applications. The end user could imagine TF as a meta-application (an application that interacts with other applications and operating systems) which is more in the style of services like IFTTT or assistants like Siri. In the long term the impredicative nature of TF will allow for real-time (or human-time) adaption of the system for the user by the user.

### Where does this come from?

If TF is based on innovative ideas we can legitimately ask - where are those ideas are coming from?

It is unlikely that someone trained within a particular discipline is going to have fundamental insights about that discipline from within that discipline. The education and success of someone within a discipline is tied to deeply integrating the discipline's current fundamental assumptions (often unknowingly) and running with them. There is more chance of someone trained in a different discipline being capable of seeing and questioning fundamental assumptions, for example, we see this when Rashevsky the physicist moved into the field of biology. It takes years to build new mental models and very few people have the opportunity to invest in a multi-disciplinary education[^mm].

The sequence that led me to TF was unintentional and unplanned. After the fact I can tell a coherent story but I was stumbling along that path not following a map. I had a relatively successful engineering career having started a company that created a new category of electronic design automation tool but I was frustrated with engineering and the sale of that company was an opportunity to pursue other interests. I perceived the biggest challenges we face not as engineering challenges but human challenges - we have all the technology we need (not all that we want) and a severe lack of cooperation. The reductive thinking that is so successful in engineering cannot address those issues. That led me to studying social-psychology and completing a two year diploma in social constructionism.

Most of my study in social constructionism was concerned with its theory and related philosophies. I was interested in understanding the social construction of social constructionism and was priveledged to be mentored by Kenneth Gergen (a founding figure of social constructionism). This was a very educational experience but not professionalizing. Upon completing the diploma I searched for how insights from social constructionism might be applied (a concrete example of this is the field of Appreciative Inquiry[^2]). That search led to the area of systems thinking and anticipation studies (an inter-disciplinary study of anticipation) and there I found Robert Rosen's work on anticipatory systems.

I studied anticipatory systems (an application of relational biology) under the tutelage of Rosen's brilliant student Aloisius Louie for about 6 months. It became clear to that, metaphorically speaking, relational biology was to science what social constructionsim was to the humanities, and the field where these ideas could intersect was artificial intelligence, so I've been studying artificial intelligence for the last few years (primarily bio-inspired approaches). One concrete result of that study is the leading detector on the Numenta anomaly detection benchmark based on an implementation of Stephen Grossberg's adaptive resonance theory (ART) from computational neuroscience[^3]. TF is quite a different approach to AI than ART and the move in that direction was mainly driven by ethical concerns and the success of the transformer architecture in deep learning.

If the ideas underlying TF are valuable then that is because I have taken them from geniuses. If they ideas are not valuable then it is more likely my misunderstandings.

### Philosophy

A key insight behind TF comes from relational biology and its formalism of complex systems. We can understand the history of modern technology as a story of progress in the mastery of simple systems (as opposed to complex systems). It is important to note that the formal class of simple systems includes "complicated" systems, for example, a spaceship is in the class of simple systems but it is extremely complicated and certain designs are beyond our current collective capacity. The class of complex systems is characterized by impredicativity (self-referencing feedforward loops i.e, anticipatory behavior). We have very little understanding of complex systems and most of the great challenges of the 21st century will be related to complex systems, for example, artificial general intelligence, neuroscience, biology, psychology, sociology, politics, etc.

Simple systems can be accurately described with an algorithm, they can be understood through reductive analysis (e.g., divide and conquer tactics), they can be engineered because theories allow for reliable predictions. Complex systems cannot be fully described by algorithms, they are open systems, in the sense of adapting with the environment (note, this is not the thermodynamic definition of closed/open). Complex systems are inherently unpredictable (but that does not mean all predictions will be wrong). These are the problems the hard sciences largely ignore (e.g., formal theories of life, the hard problem in consciousness studies, formal theories of intelligence) because current simple models do not "yet" apply (relational biology provides a formal, mathematical, explanation for why they never will apply). Our education system largely ignores complexity, it is typically not studied prior to graduation. The first, often painful, lesson of complex systems is that the education can be a part of the problem rather than the solution, which is quite a costly lesson if you are heavily invested.

* TF can be understood as an experiment in embracing complexity rather than ignoring complexity (or as is more often the case, being ignorant of complexity).

Another key insight behind TF comes from social constructionism which is a domain within social-psychology. Typically we think of psychology and sociology as distinct topics but social-psychology avoids making that a fundamental distinction. We can attempt to understand the world as a collection of individuals and that will build simple erroneous models. We can attempt to understand the world through social/cultural/environmental models that will also be simple and erroneous. Social-psychology is a step toward realizing this and searching for alternative assumptions. 

The systems that interest social-psychology fall within the class of complex systems but few social-psychologists know how to formalize complex systems. A social-psychology department within a university of science is bound to simple models. Academic disciplines aspire toward scientific methods when they can because modernity is the product of those methods, so that is where power accumulates. Social constructionism was born of the realisation that social-psychology is not a science but instead generates unreliable results and the ensuing reproducibility crisis is still with us 50 years later. Social constructionsim is closely related with the humanities, partly because that was nearly the only alternative for studying complex systems within academia at the time. 

Social constructionsim was heavily influenced by the "relational turn" at the beginning of the 21st century. This is a move away from understanding systems in terms of structure and entities with "essential" qualities. Of course there are no relations without entities and no entities without relations and a great deal of contemporary "relationalism" is essentialising relations i.e., the same simple models with a new vocabulary. However there is a long history (pre-dating Western civilization) of process philosophy that proposes an alternative set of assumptions for a radical relationalism where processes are fundamental. Social constructionism has moved increasingly toward processism (a process centric understanding of reality).

* TF is intended to support the development of complex systems from a process centric perspective.

It is worth noting that social constructionism started with an emphasis on the role of langauge, some of the insights from social constructionsim are born out in the "surprising" abilities of today's large language models (LLM). There are insights from the early days of social constructionism that are directly applicable to LLM systems.

It is hard to underestimate how deep our essentialist assumptions go. Modernity is the triumph of essentialism over processism and its hubris has lead to the complex problems we must resolve to survive the 21st century. There are many interpretations within process philosophy, some are informed by non-Western philosophies (e.g. concepts associated with Buddhism, Daoism, Dharma, etc.), the preference within social constructionism is a non-foundational stance. Foundationalism is the widely held belief that we must be standing on solid ground (absolute truths) to make good decisions. Non-foundationalism is the realisation that the illusion of solid ground is part of the problem, not a viable solution. This is, unfortunately, another lesson that is often painful if learned. It is perfectly normal to adopt a foundational belief that we have been indoctrinated into. It is typical to look for another foundational belief system when the first one fails us. Nobody embraces tearing down the foundations of their identity but there are alternatives to foundationalism. The alternatives offer more freedom, however that freedom is outside the guilded cage of modern slavery, it may not appear as an enticing option.

#### Relational Intelligence

At the intersection of relational biology, social constructionism, and artificial intelligence, we find a definition of relational intelligence that orients the TF project. Relational intelligence (RI) offers a new direction in the realm of human-machine collaboration, one that appreciates the complexity and richness of human interactions and transcends the limitations of artificiality. By embracing RI, we can develop technology that truly enhances and complements human capabilities, fostering a future where technology is not just a tool, but a partner in our collective journey towards a more interconnected and empathetic society. This conception of RI is explored further in [Relational Intelligence: An Overview](relational_intelligence.md)

### Technology

The philosophical inspiration for TF is of little consequence for TF development unless it leads to technological differentiation. TF is an ongoing experiment so we cannot predict the outcome. Still, one predictor of future performance can be past performance, however imperfect that is, it might help. So, at this stage, what distinguishes TF? What can TF teach us?

In summary:

* Intended for complex systems - make the impossible possible
* An application neutral application framework - where possible TF is itself built from Tasks (facilitating impredicativity)
* Process centric (Tasks have state machines)
* Structural state machine configuration - XState specification
* Support for distributed Task objects
* Generic Task processing - the input to a Task may be from another Task, another software system, a user, or an AI
* Compact programmatic configuration of taskflows - hierarchical configurations with inheritance
* Language neutral Task object (JSON)
* Hub-and-spoke scalability. Not cloud centric to allow for compute and data owned and operated privately by citizens.
* Open source
* Meta-tasks, multi-perspective, impredicative (complex), humans-in-the-loop systems
* TF as a technology for modelling complex processes

Typical software frameworks make a complicated problem more manageable. TF is concerned with complex systems and we assume that current software frameworks assume the class of simple system (however complicated they may be). While DAGs are great they can only express simple systems.

TF is similar to an application framework. Often application frameworks target a particular type of application and are limited to particular operating systems or software languages. TF builds on a generic notions of Tasks. Where possible TF uses Tasks to provide TF features.

TF is similar to a workflow management tool. It is also different from most workflow management tools in that Tasks are distributed (a single Task can run on many Nodes). Another difference is how communication in TF can use information from the Task object, most workflow engines process generic jobs and do not read/write job contents. Workflow management tools focus on facilitating the configuration of a workflow, TF favors using a programming language with JSON to configure workflows. If we need a GUI for configuring workflows this will be built as a TF application.

TF is similar to micro-service architectures whereby Nodes provide services and Tasks may use local storage independent of TF. One important difference is that micro-service architectures are either generic (i.e., do not restrict the system to Task objects as TF does) or they are specific to an application, while TF is somewhere in between. For example, we know that Tasks have states and we can use that information to improve routing. Many modern micro-service architectures are optimized for a grid structure "in the cloud" with particular attention to scalability and performance while TF is concerned about supporting heterogenous systems (e.g. eventually connecting many user owned TF systems into a TF network)

TF adopts a hub-and-spoke architecture. It is intended to support hub-to-hub connections in the future. This allows for a mix of vertical and horizontal scaling as well as distributed scaling (while also supporting simple single user configurations).

TF is similar to stream processing and complex event processing (CEP) architectures. Systems like Apache Flink provide this (and at scale) although they are intended to build applications for data engineers rather than non-technical end users. If TF needs high performance stream processing then it will likely make use of a system like Apache Flink rather than seek to duplicate it.

In TF the user interface is just another Node that processes Tasks i.e., the input to a Task may be another Task, another software system, a user, or an AI.

Many software projects are tightly associated with a particular languages. TF has been built, so far, using Javascript but it has been designed to be language neutral with a JSON Task description and the possibility of implementing Nodes to support any language/environment. This may be advantageous if particular Task functions are more easily implemented in a particular environment.

TF, like many software projects, is open source. The intention is to avoid TF being captured by capitalistic motives. Application specific information can be held in confidential closed source configurations of TF while generic Task functions can be shared within an open source community of developers. There should be significant financial potential for customizing TF to particular business cases which will fund the development of TF for eventual adoption by private citizens.

TF supports the XState structural definition of state machines which allows for composable state machines (a single Task can have different state machine configurations with different behaviors). TF does not require the use of XState so simple state machines can be implemented within the Task function while conforming to the Task definition for storing the Task state in the Task object.

The design of TF reflects a desire to build a system that supports meta-levels of processing: tasks that observe and control tasks. There is also a desire to allow for cross-cutting concerns to go beyond aspect oriented programming to support the interaction of application level "perspectives". Ultimately the intention is to build impredicative systems with humans-in-the-loop to allow for the development of complex human solutions to complex human problems. TF will be used to build TF Assistants that will assist TF developers. The task centric architecture is intended to allow a path to an impredicative system.

Processism encourages us to see TF as a tool for modelling complex processes (e.g., organizations) and regularly calibrate that model because we know it will always diverge. These models can be used to generate relational descriptions of a relevant context and that context can be used by an application to assist humans in navigating complex problems.

An inherent property of processes is their temporal nature. Processism encourages TF to go beyond modeling relations and entities to capture the temporal aspects of systems TF is interacting with. A user's context can be captured by the relations that are relevant to that context. The relations are a snapshot of a dynamic system so TF is intended to help model the system and extract relations from the model. Recent advances in LLM allow for a system to proactively seek relevant information for aligning the model with reality, for example, the system can ask questions of people participating in the system.

Ultimately TF will realize a relational perspective in its implementation. Today's TF is a long way from what TF needs to become.

#### Lessons Learnt

So far, what has TF taught me?

Six months into the project the definition of relational intellgience crystalized. This gives a much clearer orientation to the project. This understanding resulted from a number of interactions, in particular when presenting concepts for the Taos Institute audience and when working on a demo application intended to assist a small business. 

I started working on TF because I wanted a system to be able to prototype new approaches to AI but it may have been more effective to start with use cases and architect the system. The scope of the project makes rapid iteration difficult. I am confronting use cases as TF features permit prototyping them. It may be wiser to also think more about use cases that are months/years of development away to see if this can orient the TF architecture in useful ways.

The way TF is built is not very different from other software systems. Partly this is because we are leveraging a mature software langauge and this tends to "frame" the way we think about coding. It is also because I do not have a profound grasp of computational theory so I am limited to my experience in developing software. I expect TF will be refactored by developers far more capable than myself. However I might have benefited greatly by finding experienced software architects who could influence major decisions. For example, it seems that an event based architecture might be a good fit for TF and the earlier that was realized the less code there would be to refactor.

The underlying principles guiding TF are at the intersection on the fringes of contemporary research (e.g. social contructionism and relational biology). I have, to a large extent, given up explaining these concepts to technologists because it takes so much time and there are so many barriers. It is not obvious where to find people who grasp these principles and also have the technical know-how to find new perspectives on software architecture. TF is an attempt to make some of these principles more concrete and demonstrate advantages but I find my self in a "chicken-and-egg" situation. One hope is that a system building on LLM can help people explore and grasp new perspectives, like processism, more rapidly and less painfully. Still the difficulty is not purely intellectual, it is quite possible to confuse a capacity to talk in a new way with becoming a new person. It seems likely that grasping these perspectives requires new practices and integrating this knowledge into a way of being is time consuming. There is hope that a system leveraging LLM can accompany people in a process of transformation rather than a transfer of information.

##### Lessons for Coding

The problem TF is addressing is overwhelming and attempts at planning led to unrealistic plans. It would take so long to learn about all the technologies TF could or should use that by the time I had learnt about the last pieces of the puzzle the first pieces may no longer fit! The world of software moves fast and the world of AI is moving faster still. So I decided to "jump in" and hope I could refactor my way out. Refactoring code is time consuming so I am unsure that was a wise move. It may have been better to build small prototypes and throw them away but problems become apparent once things become complicated. I am very much looking forward to having a TF assistant to help me with TF!

Coding alone has advantages and it is comical to be coding a system for relational intelligence alone When refactoring with all the information about the system is in one brain, sleeping does a lot of the work. Still there is a lack of knowledge on my part and I'm sure to have made poor software architecture decisions. I consider TF to be a prototype.

I've made extensive use of GPT-4 as a pair programmer. It can be very effective for picking up a new library or concept. It can also lead me down rabbit holes when I am asking about an area that neither the model nor I actually understand. GPT-4 is also very effective in helping to discover ideas and keywords that I need to learn more about.

TF started with a pre-exisiting GitHub project providing a simple chatbot using React Javascript for the client and Node for the server. It did not have streaming responses but it provided a big jump start having something that worked and was understandable. That was refactored into a Task processing system and at some point it became obvious we could think of the client and server as both being Task processors.

The desire for scalablity led to the hub-and-spoke architecture and a separation of the "server" into two server code bases (a hub node and a processor node). The concern about having a bottleneck at the hub led to a coprocessor code base. Experimenitng with an RXJS processor created another code base. Trying to keep all this in sync while refactoring it became very clear there should be a single code base that can be configured as a hub or processor or coprocessor. At the time of writing this I still need to refactor the code to merge the hub and rxjs processor but the rxjs node can be used as a hub consumer, hub coprocessor, and a processor consumer.

The pre-existing GitHub project used HTTP communication. Streaming websocket responses were added for the chat interface, then the sending of Tasks from the hub was moved to websocket, then the sending of Tasks to the hub was moved to websocket. Currently the hub still provides an HTTP interface for user authentication. There is no major inconvenience for debug when using websocket, I could have made that move earlier.

In theory the React processor running in the browser can use a very similar code base to the Node processor. However the React code diverged because I was experimenting with various strategies in React.

### Ethics

There is a lot to be said about the relational ethics inspiring TF but here is not the place to justify that position. TF assumes that all advanced technology is moral (not amoral). This is the opposite of the dominant modern belief that technology is amoral (can be used equally for good and for bad). This understanding is obvious from the perspective of social constructionism where we see technology as the result of groups of individuals collaborating within a cultural and historical context to understand and engineer material systems. If our most brilliant applied mathematicians work in finance and not biological mathematics (another term to describe research in relational biology) this is of little surprise, given the society we have constructed. If fields like molecular biology exist it is because of the inane reductionism, which is so rampant that our scientists do not realize that molecules are studied in chemistry not biology (which should be about living systems!).

TF is particularly concerned about artificial intelligence and how we can reimagine this as relational intelligence. The goal of AI as a field is to enable artificial general intelligence (AGI) and given that the field does not even have a formal definition of intelligence we can worry about why this research is perceived as being scientific. Naive conceptions of morality enable immoral research, for example, we know that human intelligence is certainly not autonomous - we would not be intelligent at all without our need and ability to collaborate and cooperate. It is the naive essentialist perception of entities exisiting independently contained within perceived material boundaries that leads to the bizarre conception of intellignece being "inside" the brain or the box. Who is the primary funder of autonomous systems research - you guessed it - the military. Who has a track record of using new technology to kill humans on mass - Western civilization. Who is busily trying to build the systems that will be put in the hands of the sociopaths leading nation states? That technology will exist because people made moral decisions to ignore their responsibility.

The serious complex problems confronting are relational not material. The symptoms of imagining ourselves as distinct from the environment and the future leads to accelerated climate change. The symptoms of imagining ourselves as born with a nationality leads to famine and disease on biblical scales in the modern world. The symptoms of imagining ourselves as independent individuals leads to the epidemic of depression and suicide. AI researchers can choose to chase after "autonomous" intelligence and limit their childrens' future to a guilded cage that is only going to get smaller. On the other hand AI researchers can choose to build technologies to enhance our abilities to collaborate, cooperate, and relate. In either case the technologies have these moral biases built in.

[^1]: Ideally the markdown files forming this documentation could be edited in VSCode and links could open in VSCode tabs with the Office Viewer markdown extension (WYSIWYG editor). At the moment links do not open when connected to a remote docker container which make navigating the documentation inside VSCode unfriendly.
    
[^2]: Notabley AI refes to Apperciative Inquiry in the world of social constructionists!
    
[^3]: https://github.com/numenta/NAB leading detector was ARTime as of December 2023
    
[^mm]: It is surprisingly easy to use existing mental models with the syntax of a new discipline to give an appereance of understanding but I doubt anyone who has studied a discipline for years holds on to the understanding they had after months of study.
