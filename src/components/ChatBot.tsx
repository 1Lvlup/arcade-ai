import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ManualSelector } from '@/components/ManualSelector';
import { 
  MessageCircle, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  FileText,
  Image as ImageIcon,
  ExternalLink 
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  searchResults?: SearchResult[];
}

interface SearchResult {
  id: string;
  content: string;
  manual_id: string;
  manual_title: string;
  page_start?: number;
  page_end?: number;
  menu_path?: string;
  similarity: number;
  content_type: 'text' | 'figure';
  image_available?: boolean;
}

interface ChatBotProps {
  selectedManualId?: string;
  manualTitle?: string;
}

export function ChatBot({ selectedManualId: initialManualId, manualTitle: initialManualTitle }: ChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string | null>(initialManualId || null);
  const [manualTitle, setManualTitle] = useState<string | null>(initialManualTitle || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const updateWelcomeMessage = () => {
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      type: 'bot',
      content: selectedManualId 
        ? `Hi! I'm your Arcade Fix Guru assistant. I'll help you troubleshoot issues with "${manualTitle}". What problem are you experiencing?`
        : `Hi! I'm your Arcade Fix Guru assistant. I'll search through all your uploaded manuals to help you troubleshoot arcade machine issues. What can I help you with today?`,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  };

  useEffect(() => {
    updateWelcomeMessage();
  }, [selectedManualId, manualTitle]);

  const handleManualChange = (newManualId: string | null, newManualTitle: string | null) => {
    setSelectedManualId(newManualId);
    setManualTitle(newManualTitle);
    // Clear chat history when switching manuals
    setMessages([]);
    // Update welcome message will be triggered by useEffect
  };

  const searchManuals = async (query: string, manualId?: string | null): Promise<SearchResult[]> => {
    const searchParams = {
      query,
      manual_id: manualId !== undefined ? manualId : selectedManualId,
      max_results: 5
    };
    
    console.log('🔍 [CHAT] Starting manual search:', {
      query: query.slice(0, 100) + (query.length > 100 ? '...' : ''),
      manual_id: searchParams.manual_id,
      max_results: searchParams.max_results,
      timestamp: new Date().toISOString()
    });

    try {
      const { data, error } = await supabase.functions.invoke('search-manuals', {
        body: searchParams
      });

      if (error) {
        console.error('❌ [CHAT] Search function returned error:', {
          error,
          searchParams,
          timestamp: new Date().toISOString()
        });
        throw error;
      }

      const results = data?.results || [];
      console.log('✅ [CHAT] Search completed successfully:', {
        resultsCount: results.length,
        hasResults: results.length > 0,
        firstResultPreview: results[0] ? {
          manual_title: results[0].manual_title,
          similarity: results[0].similarity,
          content_preview: results[0].content.slice(0, 50) + '...'
        } : null,
        timestamp: new Date().toISOString()
      });

      return results;
    } catch (error) {
      console.error('🚨 [CHAT] Search function failed completely:', {
        error: error.message,
        errorType: error.constructor.name,
        searchParams,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  };

  const searchWithFallback = async (query: string): Promise<{ results: SearchResult[], fallbackUsed: boolean, suggestedManuals?: string[] }> => {
    // First search in selected manual
    const primaryResults = await searchManuals(query, selectedManualId);
    
    if (primaryResults.length > 0) {
      return { results: primaryResults, fallbackUsed: false };
    }

    // If no results and we have a selected manual, search all manuals
    if (selectedManualId) {
      const fallbackResults = await searchManuals(query, null);
      if (fallbackResults.length > 0) {
        // Extract unique manual titles from fallback results
        const suggestedManuals = [...new Set(fallbackResults.map(r => r.manual_title))];
        return { 
          results: fallbackResults, 
          fallbackUsed: true, 
          suggestedManuals 
        };
      }
    }

    return { results: [], fallbackUsed: false };
  };

  const generateResponse = async (
    query: string, 
    searchResults: SearchResult[], 
    fallbackUsed: boolean = false, 
    suggestedManuals?: string[]
  ): Promise<string> => {
    console.log('🤖 [CHAT] Starting AI response generation:', {
      query: query.slice(0, 100) + (query.length > 100 ? '...' : ''),
      searchResultsCount: searchResults.length,
      fallbackUsed,
      suggestedManuals,
      selectedManual: manualTitle,
      timestamp: new Date().toISOString()
    });

    try {
      // Create context from search results
      const context = searchResults.map(result => 
        `[${result.manual_title}${result.page_start ? ` - Page ${result.page_start}` : ''}${result.menu_path ? ` - ${result.menu_path}` : ''}]\n${result.content}`
      ).join('\n\n');

      const currentManualContext = selectedManualId 
        ? `The user has selected "${manualTitle}" as their current manual but ${fallbackUsed ? 'no relevant information was found in it' : 'information was found'}.`
        : 'The user is searching across all manuals.';

      const fallbackContext = fallbackUsed && suggestedManuals 
        ? `\n\nIMPORTANT: The information below was found in other manuals (${suggestedManuals.join(', ')}), not in the user's selected manual "${manualTitle}". You should mention this and suggest they might want to select the correct manual.`
        : '';

      const systemPrompt = `You are an expert arcade machine technician assistant. Use the provided manual content to answer troubleshooting questions. Be specific, practical, and reference the manual sections when relevant.

${currentManualContext}${fallbackContext}

${fallbackUsed ? `Since no information was found in "${manualTitle}", you should:
1. Clearly state that the information isn't in their selected manual
2. Mention that you found relevant information in other manuals
3. Suggest they might have selected the wrong manual
4. Provide the helpful information found in other manuals
5. Recommend which manual they should select instead` : ''}

Always format your response clearly with:
1. A direct answer to the question
2. Step-by-step instructions when applicable  
3. Safety warnings if relevant
4. References to the manual sections used
${fallbackUsed ? '5. Clear indication of which manual contains the information' : ''}

Context from manuals:
${context}`;

      const generateParams = {
        system_prompt: systemPrompt,
        user_message: query
      };

      console.log('📤 [CHAT] Calling generate-response function:', {
        systemPromptLength: systemPrompt.length,
        userMessageLength: query.length,
        contextLength: context.length,
        timestamp: new Date().toISOString()
      });

      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: generateParams
      });

      if (error) {
        console.error('❌ [CHAT] Generate-response function returned error:', {
          error,
          generateParams: {
            ...generateParams,
            system_prompt: systemPrompt.slice(0, 100) + '...',
            user_message: query.slice(0, 100) + '...'
          },
          timestamp: new Date().toISOString()
        });
        throw error;
      }

      const response = data?.response || 'I apologize, but I encountered an issue generating a response. Please try rephrasing your question.';
      
      console.log('✅ [CHAT] AI response generated successfully:', {
        responseLength: response.length,
        responsePreview: response.slice(0, 100) + (response.length > 100 ? '...' : ''),
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error) {
      console.error('🚨 [CHAT] Generate-response function failed completely:', {
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      return 'I apologize, but I encountered an issue accessing the AI service. Please try again later.';
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    console.log('💬 [CHAT] User message submitted:', {
      messageId: userMessage.id,
      content: userMessage.content.slice(0, 100) + (userMessage.content.length > 100 ? '...' : ''),
      contentLength: userMessage.content.length,
      selectedManual: manualTitle,
      selectedManualId,
      timestamp: new Date().toISOString()
    });

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('🔄 [CHAT] Starting search with fallback strategy...');
      
      // Search with fallback strategy
      const { results: searchResults, fallbackUsed, suggestedManuals } = await searchWithFallback(userMessage.content);

      console.log('📊 [CHAT] Search strategy completed:', {
        searchResultsCount: searchResults.length,
        fallbackUsed,
        suggestedManuals,
        timestamp: new Date().toISOString()
      });

      let botResponse: string;
      if (searchResults.length === 0) {
        console.log('⚠️ [CHAT] No search results found, providing fallback guidance');
        
        // No results found anywhere - provide helpful guidance
        botResponse = selectedManualId 
          ? `I couldn't find information about "${userMessage.content}" in "${manualTitle}" or any other uploaded manuals. This could mean:

• The information might not be covered in your manuals
• Try rephrasing your question with different terms
• Make sure your manuals are fully processed (showing "Ready" status)
• Consider if this is a general arcade issue that might need different troubleshooting approaches

For common arcade issues, I can still try to provide general guidance. Would you like me to suggest some typical troubleshooting steps for this type of problem?`
          : `I couldn't find information about "${userMessage.content}" in your uploaded manuals. Make sure your manuals are fully processed (showing "Ready" status) and try rephrasing your question with different terms.

I can also provide general arcade troubleshooting guidance if you'd like. What specific symptoms are you experiencing?`;
      } else {
        console.log('🎯 [CHAT] Found search results, generating AI response...');
        botResponse = await generateResponse(userMessage.content, searchResults, fallbackUsed, suggestedManuals);
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: botResponse,
        timestamp: new Date(),
        searchResults: searchResults.length > 0 ? searchResults : undefined
      };

      console.log('✅ [CHAT] Chat cycle completed successfully:', {
        botMessageId: botMessage.id,
        responseLength: botResponse.length,
        hasSearchResults: !!botMessage.searchResults,
        timestamp: new Date().toISOString()
      });

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('🚨 [CHAT] Complete chat cycle failed:', {
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack,
        userMessage: userMessage.content.slice(0, 100),
        timestamp: new Date().toISOString()
      });

      toast({
        title: 'Error',
        description: 'Failed to process your question. Please try again.',
        variant: 'destructive',
      });

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'I apologize, but I encountered an error while processing your question. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="border-primary/20 h-[600px] flex flex-col">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span>Arcade Fix Guru Assistant</span>
          </div>
          <ManualSelector 
            selectedManualId={selectedManualId} 
            onManualChange={handleManualChange}
          />
        </CardTitle>
        {selectedManualId && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              Searching: {manualTitle}
            </Badge>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  {message.type === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                
                {/* Search Results */}
                {message.searchResults && message.searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium opacity-70">
                      Sources ({message.searchResults.length})
                    </div>
                    {message.searchResults.map((result, index) => (
                      <div
                        key={result.id}
                        className="text-xs p-2 bg-background/50 rounded border border-border"
                      >
                        <div className="flex items-center space-x-1 mb-1">
                          {result.content_type === 'figure' ? (
                            <ImageIcon className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          <span className="font-medium">{result.manual_title}</span>
                          {result.page_start && (
                            <span className="text-muted-foreground">
                              Page {result.page_start}
                            </span>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(result.similarity * 100)}% match
                          </Badge>
                        </div>
                        {result.menu_path && (
                          <div className="text-muted-foreground mb-1">
                            {result.menu_path}
                          </div>
                        )}
                        <div className="text-muted-foreground">
                          {result.content.length > 150 
                            ? `${result.content.slice(0, 150)}...` 
                            : result.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div className="border-t border-border p-4">
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about arcade machine troubleshooting..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Press Enter to send • Shift+Enter for new line
          </div>
        </div>
      </CardContent>
    </Card>
  );
}