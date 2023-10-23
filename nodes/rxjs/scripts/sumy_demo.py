from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer

# Sample long text to be summarized
text = """
Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals. Colloquially, the term "artificial intelligence" is often used to describe machines (or computers) that mimic "cognitive" functions that humans associate with the human mind, such as "learning" and "problem solving".
"""

# Parse the text
parser = PlaintextParser.from_string(text, Tokenizer("english"))

# Use the LsaSummarizer
summarizer = LsaSummarizer()
summary = summarizer(parser.document, 1)  # Summarize to 1 sentences

# Print the summary
for sentence in summary:
        print(sentence)

